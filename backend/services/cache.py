from functools import lru_cache
from typing import Dict, Any

class MemoryCacheService:
    def __init__(self, maxsize: int = 128):
        self.maxsize = maxsize

cache_service = MemoryCacheService()
