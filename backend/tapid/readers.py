"""Reader abstraction - the seam where real NFC hardware plugs in later.

Today only `SimulatedReader` exists. It is NOT hardware: it receives the tap token
directly over HTTPS from the app. A future `HardwareReader` (e.g. a door controller
running a PC/SC or ISO 14443 stack that reads a token emitted by the phone via Host
Card Emulation) only needs to produce the same (token, building_id) pair and call
POST /api/verify with its reader key. The verification service does not change.
"""
from abc import ABC, abstractmethod


class ReaderAdapter(ABC):
    reader_id: str
    is_hardware: bool

    @abstractmethod
    def describe(self) -> dict: ...


class SimulatedReader(ReaderAdapter):
    is_hardware = False

    def __init__(self, reader_id: str):
        self.reader_id = reader_id

    def describe(self) -> dict:
        return {"reader_id": self.reader_id, "is_hardware": False, "transport": "https-simulated"}


STUDENT_APP_SIMULATOR = SimulatedReader("sim-mobile-reader")
ADMIN_CONSOLE_SIMULATOR = SimulatedReader("sim-admin-console")
