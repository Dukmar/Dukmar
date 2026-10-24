"""Apple timestamps count from 2001-01-01 UTC ("Mac absolute time")."""

from datetime import datetime, timezone

APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc).timestamp()


def from_apple(value):
    """Convert an Apple timestamp (seconds or, since iOS 11, nanoseconds) to a local datetime."""
    if value in (None, "", 0):
        return None
    value = float(value)
    # Nanosecond values are ~1e17 today; second values stay below ~1e9 for centuries.
    if abs(value) > 1e11:
        value /= 1e9
    return datetime.fromtimestamp(APPLE_EPOCH + value, tz=timezone.utc).astimezone()


def to_apple_seconds(dt):
    return dt.timestamp() - APPLE_EPOCH


def fmt(dt, with_seconds=False):
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S" if with_seconds else "%Y-%m-%d %H:%M")
