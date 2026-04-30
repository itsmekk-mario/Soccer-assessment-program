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

    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mean_hue = float(np.mean(hsv[:, :, 0]))

    if mean_hue < 35 or mean_hue > 155:
        return "team_red"
    if 80 <= mean_hue <= 135:
        return "team_blue"
    return "team_light"

