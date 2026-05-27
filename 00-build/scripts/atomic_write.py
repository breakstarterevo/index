"""Atomic-write helpers for generated build output in synced folders."""

import json
import os
import tempfile
import time


WRITE_RETRIES = 3
WRITE_RETRY_DELAY_SECONDS = 0.2


def atomic_write(filepath, write_content, encoding="utf-8", newline=None):
    last_error = None

    for attempt in range(WRITE_RETRIES):
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding=encoding,
                newline=newline,
                dir=os.path.dirname(filepath),
                prefix=f".{os.path.basename(filepath)}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temp_path = handle.name
                write_content(handle)
            os.replace(temp_path, filepath)
            return
        except OSError as error:
            last_error = error
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
            if attempt + 1 < WRITE_RETRIES:
                time.sleep(WRITE_RETRY_DELAY_SECONDS)

    raise last_error


def atomic_write_text(filepath, text, encoding="utf-8", newline=None):
    atomic_write(filepath, lambda handle: handle.write(text), encoding=encoding, newline=newline)


def atomic_dump_json(filepath, payload, **kwargs):
    atomic_write(filepath, lambda handle: json.dump(payload, handle, **kwargs))
