from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


class PitchMapper:
    def __init__(self, frame_width: int, frame_height: int, pitch_length: float, pitch_width: float, matrix: Optional[list[list[float]]] = None):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.pitch_length = pitch_length
        self.pitch_width = pitch_width
        self.matrix = np.array(matrix, dtype=np.float32) if matrix is not None else None

    def _clamp_to_pitch(self, x: float, y: float) -> tuple[float, float]:
        return max(0.0, min(self.pitch_length, x)), max(0.0, min(self.pitch_width, y))

    def image_to_pitch(self, x: float, y: float) -> tuple[float, float]:
        if self.matrix is None:
            return self._clamp_to_pitch((x / self.frame_width) * self.pitch_length, (y / self.frame_height) * self.pitch_width)

        point = np.array([x, y, 1.0], dtype=np.float32)
        mapped = self.matrix @ point
        if abs(float(mapped[2])) < 1e-6:
            return self._clamp_to_pitch((x / self.frame_width) * self.pitch_length, (y / self.frame_height) * self.pitch_width)
        return self._clamp_to_pitch(float(mapped[0] / mapped[2]), float(mapped[1] / mapped[2]))


def compute_homography(image_points: list[list[float]], pitch_points: list[list[float]]) -> list[list[float]]:
    if len(image_points) != len(pitch_points):
        raise ValueError("image_points와 pitch_points 개수가 같아야 합니다.")
    if len(image_points) < 4:
        raise ValueError("homography 보정에는 최소 4개 기준점이 필요합니다.")

    src = np.array(image_points, dtype=np.float32)
    dst = np.array(pitch_points, dtype=np.float32)
    matrix, mask = cv2.findHomography(src, dst, method=0)
    if matrix is None:
        raise ValueError("homography matrix를 계산하지 못했습니다. 기준점을 다시 확인하세요.")
    return matrix.astype(float).tolist()


def load_calibration_matrix(path: str | Path) -> list[list[float]]:
    calibration_path = Path(path)
    with calibration_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if "matrix" in data:
        return data["matrix"]

    if "image_points" in data and "pitch_points" in data:
        return compute_homography(data["image_points"], data["pitch_points"])

    raise ValueError(f"보정 파일 형식이 올바르지 않습니다: {calibration_path}")
