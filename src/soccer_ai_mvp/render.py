from __future__ import annotations

import cv2
import numpy as np

from .state import PlayerState


TEAM_COLORS = {
    "team_red": (80, 90, 240),
    "team_blue": (230, 150, 70),
    "team_yellow": (70, 210, 240),
    "team_green": (90, 210, 110),
    "team_purple": (210, 110, 210),
    "team_dark": (55, 55, 55),
    "team_light": (220, 220, 220),
    "unknown": (160, 160, 160),
}

STATUS_COLORS = {
    "visible": (90, 210, 120),
    "lost": (90, 190, 240),
    "out_of_view": (150, 150, 150),
}


def draw_bbox(frame: np.ndarray, player: PlayerState) -> None:
    x1, y1, x2, y2 = [int(v) for v in player.bbox_xyxy]
    color = TEAM_COLORS.get(player.team_hint, TEAM_COLORS["unknown"]) if player.status == "visible" else STATUS_COLORS.get(player.status, (255, 255, 255))
    label = f"ID {player.track_id} {player.team_hint.replace('team_', '')} {player.status}"

    if player.status == "visible":
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    else:
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, lineType=cv2.LINE_AA)

    cv2.putText(frame, label, (x1, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)


def draw_minimap(
    frame: np.ndarray,
    players: list[PlayerState],
    pitch_length: float,
    pitch_width: float,
    map_w: int,
    map_h: int,
    margin: int,
) -> None:
    x0 = frame.shape[1] - map_w - margin
    y0 = margin
    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + map_w, y0 + map_h), (30, 75, 45), -1)
    frame[:] = cv2.addWeighted(overlay, 0.72, frame, 0.28, 0)

    white = (230, 240, 230)
    cv2.rectangle(frame, (x0, y0), (x0 + map_w, y0 + map_h), white, 2)
    cv2.line(frame, (x0 + map_w // 2, y0), (x0 + map_w // 2, y0 + map_h), white, 1)
    cv2.circle(frame, (x0 + map_w // 2, y0 + map_h // 2), int(map_h * 0.14), white, 1)
    cv2.rectangle(frame, (x0, y0 + int(map_h * 0.25)), (x0 + int(map_w * 0.16), y0 + int(map_h * 0.75)), white, 1)
    cv2.rectangle(frame, (x0 + int(map_w * 0.84), y0 + int(map_h * 0.25)), (x0 + map_w, y0 + int(map_h * 0.75)), white, 1)

    for player in players:
        px = x0 + int((player.pitch_xy[0] / pitch_length) * map_w)
        py = y0 + int((player.pitch_xy[1] / pitch_width) * map_h)
        color = TEAM_COLORS.get(player.team_hint, TEAM_COLORS["unknown"])
        radius = 5 if player.status == "visible" else 4
        cv2.circle(frame, (px, py), radius, color, -1)
        if player.status != "visible":
            cv2.circle(frame, (px, py), radius + 4, STATUS_COLORS[player.status], 1)

    cv2.putText(frame, "2D pitch", (x0 + 8, y0 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, white, 1, cv2.LINE_AA)
