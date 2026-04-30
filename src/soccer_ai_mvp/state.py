from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PlayerState:
    track_id: int
    status: str
    last_seen_frame: int
    bbox_xyxy: tuple[float, float, float, float]
    pitch_xy: tuple[float, float]
    team_hint: str
    confidence: float


class TrackStateStore:
    def __init__(self, lost_after_frames: int, out_after_frames: int):
        self.lost_after_frames = lost_after_frames
        self.out_after_frames = out_after_frames
        self.players: dict[int, PlayerState] = {}

    def update_visible(
        self,
        frame_index: int,
        track_id: int,
        bbox_xyxy: tuple[float, float, float, float],
        pitch_xy: tuple[float, float],
        team_hint: str,
        confidence: float,
    ) -> None:
        self.players[track_id] = PlayerState(
            track_id=track_id,
            status="visible",
            last_seen_frame=frame_index,
            bbox_xyxy=bbox_xyxy,
            pitch_xy=pitch_xy,
            team_hint=team_hint,
            confidence=confidence,
        )

    def mark_missing(self, frame_index: int, visible_ids: set[int]) -> None:
        for track_id, player in self.players.items():
            if track_id in visible_ids:
                continue
            missing = frame_index - player.last_seen_frame
            if missing >= self.out_after_frames:
                player.status = "out_of_view"
                player.confidence = max(0.05, player.confidence * 0.92)
            elif missing >= self.lost_after_frames:
                player.status = "lost"
                player.confidence = max(0.15, player.confidence * 0.96)

    def active_players(self) -> list[PlayerState]:
        return [player for player in self.players.values() if player.status in {"visible", "lost"}]
