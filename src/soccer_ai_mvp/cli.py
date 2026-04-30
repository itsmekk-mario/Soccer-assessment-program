from __future__ import annotations

import argparse
from pathlib import Path

import cv2
from tqdm import tqdm
from ultralytics import YOLO

from .config import load_config
from .devices import select_device
from .homography import PitchMapper
from .report import write_outputs
from .render import draw_bbox, draw_minimap
from .state import TrackStateStore
from .team_color import estimate_team_hint


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="축구 경기 영상 분석 MVP")
    parser.add_argument("--input", required=True, help="입력 영상 경로")
    parser.add_argument("--output", default="data/output", help="결과 저장 폴더")
    parser.add_argument("--config", default="configs/default.yaml", help="설정 YAML")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO 모델 파일")
    parser.add_argument("--device", default="auto", help="auto, mps, cpu")
    parser.add_argument("--imgsz", type=int, default=640, help="YOLO 입력 크기")
    parser.add_argument("--skip", type=int, default=1, help="N프레임마다 1번 분석")
    parser.add_argument("--max-frames", type=int, default=0, help="0이면 전체 처리")
    return parser.parse_args()


def result_to_detections(result, person_class_id: int) -> list[dict]:
    detections: list[dict] = []
    boxes = result.boxes
    if boxes is None or boxes.xyxy is None:
        return detections

    xyxy = boxes.xyxy.cpu().numpy()
    cls = boxes.cls.cpu().numpy() if boxes.cls is not None else []
    conf = boxes.conf.cpu().numpy() if boxes.conf is not None else []
    ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else []

    for i, bbox in enumerate(xyxy):
        class_id = int(cls[i]) if len(cls) > i else -1
        if class_id != person_class_id:
            continue
        track_id = int(ids[i]) if len(ids) > i else i + 1
        detections.append(
            {
                "track_id": track_id,
                "bbox": tuple(float(v) for v in bbox),
                "confidence": float(conf[i]) if len(conf) > i else 0.0,
            }
        )
    return detections


def main() -> None:
    args = parse_args()
    config = load_config(args.config)
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    device = select_device(args.device)
    model = YOLO(args.model)

    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise RuntimeError(f"영상을 열 수 없습니다: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if args.max_frames > 0:
        total_frames = min(total_frames, args.max_frames)

    writer = cv2.VideoWriter(
        str(output_dir / "annotated.mp4"),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )

    matrix = config["homography"]["matrix"] if config["homography"]["enabled"] else None
    mapper = PitchMapper(width, height, config["pitch"]["length_m"], config["pitch"]["width_m"], matrix)
    store = TrackStateStore(config["tracking"]["lost_after_frames"], config["tracking"]["out_after_frames"])

    rows: list[dict] = []
    frame_index = 0

    pbar = tqdm(total=total_frames if total_frames > 0 else None, desc="Analyzing")
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if args.max_frames > 0 and frame_index >= args.max_frames:
            break

        should_infer = frame_index % max(1, args.skip) == 0
        visible_ids: set[int] = set()

        if should_infer:
            results = model.track(
                frame,
                persist=True,
                tracker=config["tracking"]["tracker_yaml"],
                classes=[config["detection"]["person_class_id"]],
                conf=config["detection"]["conf"],
                iou=config["detection"]["iou"],
                imgsz=args.imgsz,
                device=device,
                verbose=False,
            )
            detections = result_to_detections(results[0], config["detection"]["person_class_id"])

            for det in detections:
                x1, y1, x2, y2 = det["bbox"]
                foot_x = (x1 + x2) / 2
                foot_y = y2
                pitch_xy = mapper.image_to_pitch(foot_x, foot_y)
                team_hint = estimate_team_hint(frame, det["bbox"])
                visible_ids.add(det["track_id"])
                store.update_visible(frame_index, det["track_id"], det["bbox"], pitch_xy, team_hint, det["confidence"])

        store.mark_missing(frame_index, visible_ids)

        active_players = store.active_players()
        for player in active_players:
            draw_bbox(frame, player)
            rows.append(
                {
                    "frame": frame_index,
                    "track_id": player.track_id,
                    "status": player.status,
                    "confidence": round(player.confidence, 4),
                    "team_hint": player.team_hint,
                    "pitch_x_m": round(player.pitch_xy[0], 3),
                    "pitch_y_m": round(player.pitch_xy[1], 3),
                    "bbox_x1": round(player.bbox_xyxy[0], 2),
                    "bbox_y1": round(player.bbox_xyxy[1], 2),
                    "bbox_x2": round(player.bbox_xyxy[2], 2),
                    "bbox_y2": round(player.bbox_xyxy[3], 2),
                }
            )

        draw_minimap(
            frame,
            active_players,
            config["pitch"]["length_m"],
            config["pitch"]["width_m"],
            config["render"]["minimap_width"],
            config["render"]["minimap_height"],
            config["render"]["minimap_margin"],
        )

        writer.write(frame)
        frame_index += 1
        pbar.update(1)

    pbar.close()
    cap.release()
    writer.release()
    write_outputs(rows, output_dir, input_path, args.model, device)
    print(f"완료: {output_dir}")


if __name__ == "__main__":
    main()

