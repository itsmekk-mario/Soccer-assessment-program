from __future__ import annotations

import cv2
import numpy as np


def estimate_team_hint(frame: np.ndarray, bbox_xyxy: tuple[float, float, float, float]) -> str:
    x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
    h, w = frame.shape[:2]
    x1, x2 = max(0, x1), min(w - 1, x2)
    y1, y2 = max(0, y1), min(h - 1, y2)
    if x2 <= x1 or y2 <= y1:
        return "unknown"

    box_h = y2 - y1
    box_w = x2 - x1
    torso_y1 = y1 + int(box_h * 0.18)
    torso_y2 = y1 + int(box_h * 0.58)
    torso_x1 = x1 + int(box_w * 0.18)
    torso_x2 = x2 - int(box_w * 0.18)
    crop = frame[torso_y1:torso_y2, torso_x1:torso_x2]
    if crop.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    valid = (sat > 35) & (val > 35)
    valid_count = int(np.count_nonzero(valid))
    if valid_count < 20:
        return "unknown"

    yellow = valid & (hue >= 12) & (hue <= 42) & (val > 70)
    blue = valid & (hue >= 88) & (hue <= 132)
    dark = val < 85

    yellow_ratio = float(np.count_nonzero(yellow)) / valid_count
    blue_ratio = float(np.count_nonzero(blue)) / valid_count
    dark_ratio = float(np.count_nonzero(dark)) / crop.size * 3

    # 이 프로젝트의 현재 경기처럼 노랑 vs 파랑/검정 유니폼일 때 잔디 초록색이
    # crop에 섞여 팀으로 오인되는 것을 막기 위해 팀 후보를 보수적으로 둡니다.
    if yellow_ratio >= 0.16 and yellow_ratio >= blue_ratio * 1.2:
        return "team_yellow"
    if blue_ratio >= 0.08 or (blue_ratio >= 0.04 and dark_ratio >= 0.35):
        return "team_blue"
    if dark_ratio >= 0.58:
        return "unknown"
    return "unknown"
