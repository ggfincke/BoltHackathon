import os
import logging
from typing import List, Optional, Dict, Any
from .base_upc_lookup import BaseUPCLookup, UPCResult
from .barcode_lookup import BarcodeLookupService

# UPCManager class - manages multiple UPC lookup services w/ fallback & caching
class UPCManager:    
    def __init__(self, logger: logging.Logger = None, enable_caching: bool = True, supabase_client=None):
        self.logger = logger or logging.getLogger(__name__)
        self.services: List[BaseUPCLookup] = []
        self.enable_caching = enable_caching
        self._cache: Dict[str, UPCResult] = {}
        self.supabase = supabase_client
        
        # init default services
        self._initialize_default_services()
    
    # init
    def _initialize_default_services(self):
        # init services
        services_added = 0
        
        # BarcodeLookup.com (default)
        try:
            # init BarcodeLookup.com service
            barcode_service = BarcodeLookupService(
                max_pages=3,
                similarity_threshold=0.45,
                headless=True,
                logger=self.logger
            )
            self.add_service(barcode_service)
            services_added += 1
            self.logger.info("✓ Initialized BarcodeLookup service")
        except Exception as e:
            self.logger.error(f"✗ Failed to initialize BarcodeLookup service: {e}")
        
        # if no services were added, log a warning
        if services_added == 0:
            self.logger.warning("No UPC lookup services were successfully initialized!")
        else:
            self.logger.info(f"Initialized {services_added} UPC lookup service(s)")
    

    # add service
    def add_service(self, service: BaseUPCLookup, priority: int = None):
        # insert at specific position based on priority
        if priority is not None:
            self.services.insert(priority, service)
        else:
            # add to end of list
            self.services.append(service)
        
        self.logger.info(f"Added UPC lookup service: {service.service_name} "
                        f"(total services: {len(self.services)})")
    
    # remove service
    def remove_service(self, service_name: str) -> bool:
        # remove service by name
        for i, service in enumerate(self.services):
            if service.service_name == service_name:
                removed_service = self.services.pop(i)
                self.logger.info(f"Removed UPC lookup service: {service_name}")
                return True
        
        self.logger.warning(f"Service not found for removal: {service_name}")
        return False
    
    # lookup UPC
    def lookup_upc(self, product_name: str, try_all_services: bool = True, 
                   retailer_source: str = None, original_url: str = None) -> Optional[UPCResult]:
        if not product_name or not product_name.strip():
            return None
        
        # check cache first
        cache_key = product_name.lower().strip()
        if self.enable_caching and cache_key in self._cache:
            cached_result = self._cache[cache_key]
            self.logger.debug(f"UPC cache hit for: {product_name}")
            # return cached result even if it's a negative result
            return cached_result if cached_result.upc else None
        
        # try each service until we get a successful result
        services_tried = 0
        services_available = 0
        last_error = None
        services_attempted = []
        
        for service in self.services:
            # check if service is available
            try:
                if not service.is_available():
                    self.logger.debug(f"Service {service.service_name} is not available, skipping")
                    continue
                services_available += 1
            except Exception as e:
                self.logger.warning(f"Error checking availability of {service.service_name}: {e}")
                continue
            
            services_tried += 1
            services_attempted.append(service.service_name)
            self.logger.info(f"Trying UPC lookup for '{product_name}' using {service.service_name} "
                           f"(service {services_tried}/{services_available})")
            
            try:
                result = service.lookup_upc(product_name)
                
                # check for valid UPC result
                if result and result.upc and result.upc.strip():
                    self.logger.info(f"✓ Found UPC {result.upc} for '{product_name}' using {service.service_name} "
                                   f"(confidence: {result.confidence_score:.2f})")
                    
                    # cache the successful result
                    if self.enable_caching:
                        self._cache[cache_key] = result
                    
                    return result
                else:
                    # service returned but no UPC found
                    confidence = result.confidence_score if result else 0.0
                    self.logger.info(f"✗ No UPC found for '{product_name}' using {service.service_name} "
                                   f"(confidence: {confidence:.2f})")
                    
                    # if not trying all services, stop here
                    if not try_all_services:
                        break
                
            except Exception as e:
                self.logger.error(f"✗ UPC lookup failed with {service.service_name} for '{product_name}': {e}")
                last_error = e
                
                # if not trying all services, stop on first error
                if not try_all_services:
                    break
                # o/w continue to next service
                continue
        
        # log final result
        if services_available == 0:
            self.logger.warning(f"No UPC lookup services available for '{product_name}'")
        else:
            self.logger.info(f"No UPC found for '{product_name}' after trying {services_tried}/{services_available} available services")
            if last_error:
                self.logger.debug(f"Last error was: {last_error}")
        
        # store failed lookup for manual review if we have supabase client
        if self.supabase:
            import asyncio
            try:
                # async store function
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # if already a running loop, create a task
                    asyncio.create_task(self._store_failed_lookup(
                        product_name=product_name,
                        retailer_source=retailer_source,
                        original_url=original_url,
                        services_tried=services_attempted,
                        last_error=last_error
                    ))
                else:
                    # run coroutine directly
                    loop.run_until_complete(self._store_failed_lookup(
                        product_name=product_name,
                        retailer_source=retailer_source,
                        original_url=original_url,
                        services_tried=services_attempted,
                        last_error=last_error
                    ))
            except Exception:
                # if asyncio doesn't work, use synchronous approach
                self._store_failed_lookup_sync(
                    product_name=product_name,
                    retailer_source=retailer_source,
                    original_url=original_url,
                    services_tried=services_attempted,
                    last_error=last_error
                )

        # cache negative result to avoid repeated lookups
        if self.enable_caching:
            negative_result = UPCResult(
                upc=None,
                confidence_score=0.0,
                source_service="none",
                product_title=product_name,
                metadata={
                    "cached_negative": True,
                    "services_tried": services_tried,
                    "services_available": services_available,
                    "last_error": str(last_error) if last_error else None
                }
            )
            self._cache[cache_key] = negative_result
        
        return None

    # store failed lookup - async version
    async def _store_failed_lookup(self, product_name: str, retailer_source: str = None, 
                                  original_url: str = None, services_tried: List[str] = None, 
                                  last_error: Exception = None):
        # async version
        try:
            normalized_name = product_name.lower().strip()
            
            # check if already exists to avoid duplicates
            existing = self.supabase.table('failed_upc_lookups')\
                .select('id, retry_count')\
                .eq('normalized_name', normalized_name)\
                .execute()
            
            if existing.data:
                # update retry count
                self.supabase.table('failed_upc_lookups')\
                    .update({'retry_count': existing.data[0]['retry_count'] + 1})\
                    .eq('id', existing.data[0]['id'])\
                    .execute()
            else:
                # insert new failed lookup
                self.supabase.table('failed_upc_lookups')\
                    .insert({
                        'product_name': product_name,
                        'normalized_name': normalized_name,
                        'retailer_source': retailer_source,
                        'original_url': original_url,
                        'failure_reason': f"No UPC found after {len(services_tried or [])} service attempts",
                        'services_tried': services_tried or [],
                        'last_error': str(last_error) if last_error else None,
                        'status': 'pending'
                    })\
                    .execute()
                    
            self.logger.info(f"Stored failed UPC lookup for manual review: {product_name}")
            
        except Exception as e:
            self.logger.error(f"Failed to store failed UPC lookup: {e}")

    # store failed lookup - sync version
    def _store_failed_lookup_sync(self, product_name: str, retailer_source: str = None, 
                                 original_url: str = None, services_tried: List[str] = None, 
                                 last_error: Exception = None):
        # sync version
        try:
            normalized_name = product_name.lower().strip()
            
            # check if already exists to avoid duplicates
            existing = self.supabase.table('failed_upc_lookups')\
                .select('id, retry_count')\
                .eq('normalized_name', normalized_name)\
                .execute()
            
            if existing.data:
                # update retry count
                self.supabase.table('failed_upc_lookups')\
                    .update({'retry_count': existing.data[0]['retry_count'] + 1})\
                    .eq('id', existing.data[0]['id'])\
                    .execute()
            else:
                # insert new failed lookup
                self.supabase.table('failed_upc_lookups')\
                    .insert({
                        'product_name': product_name,
                        'normalized_name': normalized_name,
                        'retailer_source': retailer_source,
                        'original_url': original_url,
                        'failure_reason': f"No UPC found after {len(services_tried or [])} service attempts",
                        'services_tried': services_tried or [],
                        'last_error': str(last_error) if last_error else None,
                        'status': 'pending'
                    })\
                    .execute()
                    
            self.logger.info(f"Stored failed UPC lookup for manual review: {product_name}")
            
        except Exception as e:
            self.logger.error(f"Failed to store failed UPC lookup: {e}")
    
    # get cache stats
    def get_cache_stats(self) -> Dict[str, Any]:
        # get caching statistics
        if not self.enable_caching:
            return {"caching_enabled": False}
        
        total_entries = len(self._cache)
        successful_lookups = sum(1 for result in self._cache.values() if result.upc is not None)
        
        return {
            "caching_enabled": True,
            "total_entries": total_entries,
            "successful_lookups": successful_lookups,
            "negative_results": total_entries - successful_lookups,
            "cache_hit_ratio": successful_lookups / total_entries if total_entries > 0 else 0.0
        }
    
    # get service status
    def get_service_status(self) -> Dict[str, Any]:
        # get status of all registered services
        services_status = []
        for service in self.services:
            try:
                is_available = service.is_available()
                status = "available" if is_available else "unavailable"
            except Exception as e:
                status = f"error: {str(e)}"
            
            services_status.append({
                "service_name": service.service_name,
                "status": status
            })
        
        return {
            "total_services": len(self.services),
            "services": services_status
        }
    
    # clear cache
    def clear_cache(self):
        # clear the UPC lookup cache
        self._cache.clear()
        self.logger.info("UPC lookup cache cleared")
    
    # cleanup
    def cleanup(self):
        # clean up all services
        for service in self.services:
            try:
                service.cleanup()
            except Exception as e:
                self.logger.error(f"Error cleaning up service {service.service_name}: {e}")
        
        self.logger.info("UPC manager cleanup completed")

# factory function for easy initialization
def create_upc_manager(logger: logging.Logger = None, supabase_client=None) -> UPCManager:
    # create & return a configured UPC manager
    return UPCManager(logger=logger, supabase_client=supabase_client)