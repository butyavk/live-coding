from datetime import timedelta


def merge_periods(periods):
    for start, end in periods:
        if end <= start:
            raise ValueError(f"empty or negative period: {start} .. {end}")
    merged = []
    for start, end in sorted(periods):
        if merged and start <= merged[-1][1]:            # overlaps or touches
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def total_access(periods) -> timedelta:
    return sum((end - start for start, end in merge_periods(periods)), timedelta(0))
