import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

# FailedUPCManager class - manager for handling failed UPC lookups and manual review processes
class FailedUPCManager:
    
    def __init__(self, supabase_client, logger: logging.Logger = None):
        self.supabase = supabase_client
        self.logger = logger or logging.getLogger(__name__)
    
    # get failed lookups needing manual review
    def get_pending_reviews(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        try:
            response = self.supabase.table('failed_upc_lookups')\
                .select('*')\
                .eq('status', 'pending')\
                .order('created_at')\
                .range(offset, offset + limit - 1)\
                .execute()
            
            return {
                "success": True,
                "data": response.data,
                "count": len(response.data)
            }
        except Exception as e:
            self.logger.error(f"Error getting pending reviews: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "count": 0
            }
    
    # get total count of pending reviews
    def get_pending_count(self) -> int:
        try:
            response = self.supabase.table('failed_upc_lookups')\
                .select('id', count='exact')\
                .eq('status', 'pending')\
                .execute()
            
            return response.count or 0
        except Exception as e:
            self.logger.error(f"Error getting pending count: {e}")
            return 0
    
    # assign failed lookup to a user for review
    def assign_for_review(self, lookup_id: str, user_id: str) -> Dict[str, Any]:
        try:
            response = self.supabase.table('failed_upc_lookups')\
                .update({
                    'status': 'in_review',
                    'assigned_to': user_id,
                    'updated_at': datetime.utcnow().isoformat()
                })\
                .eq('id', lookup_id)\
                .execute()
            
            if response.data:
                self.logger.info(f"Assigned failed lookup {lookup_id} to user {user_id}")
                return {
                    "success": True,
                    "data": response.data[0]
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to assign lookup - record not found"
                }
                
        except Exception as e:
            self.logger.error(f"Error assigning lookup for review: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # resolve failed lookup with manually found UPC
    def resolve_with_upc(self, lookup_id: str, manual_upc: str, 
                        confidence: float, notes: str = None) -> Dict[str, Any]:
        try:
            # validate UPC format (basic check)
            if not manual_upc or not manual_upc.isdigit():
                return {
                    "success": False,
                    "error": "Invalid UPC format - must be numeric"
                }
            
            # validate confidence score
            if not (0.0 <= confidence <= 1.0):
                return {
                    "success": False,
                    "error": "Confidence must be between 0.0 and 1.0"
                }
            
            response = self.supabase.table('failed_upc_lookups')\
                .update({
                    'status': 'resolved',
                    'manual_upc': manual_upc,
                    'confidence_override': confidence,
                    'notes': notes,
                    'resolved_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })\
                .eq('id', lookup_id)\
                .execute()
            
            if response.data:
                self.logger.info(f"Resolved failed lookup {lookup_id} with UPC {manual_upc}")
                return {
                    "success": True,
                    "data": response.data[0]
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to resolve lookup - record not found"
                }
                
        except Exception as e:
            self.logger.error(f"Error resolving lookup with UPC: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # mark a failed lookup as ignored (not resolvable)
    def mark_as_ignored(self, lookup_id: str, reason: str = None) -> Dict[str, Any]:
        try:
            response = self.supabase.table('failed_upc_lookups')\
                .update({
                    'status': 'ignored',
                    'notes': reason,
                    'resolved_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                })\
                .eq('id', lookup_id)\
                .execute()
            
            if response.data:
                self.logger.info(f"Marked failed lookup {lookup_id} as ignored")
                return {
                    "success": True,
                    "data": response.data[0]
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to mark as ignored - record not found"
                }
                
        except Exception as e:
            self.logger.error(f"Error marking lookup as ignored: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # get failed lookups assigned to a specific user
    def get_reviews_by_user(self, user_id: str, status: str = None, limit: int = 50) -> Dict[str, Any]:
        try:
            query = self.supabase.table('failed_upc_lookups')\
                .select('*')\
                .eq('assigned_to', user_id)
            
            if status:
                query = query.eq('status', status)
            
            response = query.order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return {
                "success": True,
                "data": response.data,
                "count": len(response.data)
            }
        except Exception as e:
            self.logger.error(f"Error getting reviews by user: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "count": 0
            }
    
    # get statistics about failed UPC lookups
    def get_statistics(self) -> Dict[str, Any]:
        try:
            # get counts by status
            stats = {}
            statuses = ['pending', 'in_review', 'resolved', 'ignored']
            
            for status in statuses:
                response = self.supabase.table('failed_upc_lookups')\
                    .select('id', count='exact')\
                    .eq('status', status)\
                    .execute()
                stats[f"{status}_count"] = response.count or 0
            
            # get total count
            total_response = self.supabase.table('failed_upc_lookups')\
                .select('id', count='exact')\
                .execute()
            stats['total_count'] = total_response.count or 0
            
            # get retry count distribution
            retry_response = self.supabase.table('failed_upc_lookups')\
                .select('retry_count')\
                .execute()
            
            retry_counts = [item['retry_count'] for item in retry_response.data]
            if retry_counts:
                stats['avg_retry_count'] = sum(retry_counts) / len(retry_counts)
                stats['max_retry_count'] = max(retry_counts)
            else:
                stats['avg_retry_count'] = 0
                stats['max_retry_count'] = 0
            
            # success rate (resolved / total)
            if stats['total_count'] > 0:
                stats['success_rate'] = stats['resolved_count'] / stats['total_count']
            else:
                stats['success_rate'] = 0.0
            
            return {
                "success": True,
                "data": stats
            }
            
        except Exception as e:
            self.logger.error(f"Error getting statistics: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {}
            }
    
    # retry failed lookups that haven't exceeded max retries
    def retry_failed_lookups(self, upc_manager, max_retries: int = 3, limit: int = 10) -> Dict[str, Any]:
        try:
            # get failed lookups to retry
            response = self.supabase.table('failed_upc_lookups')\
                .select('*')\
                .eq('status', 'pending')\
                .lt('retry_count', max_retries)\
                .order('created_at')\
                .limit(limit)\
                .execute()
            
            results = {
                "attempted": 0,
                "successful": 0,
                "failed": 0,
                "details": []
            }
            
            for lookup in response.data:
                results["attempted"] += 1
                
                # attempt UPC lookup again
                upc_result = upc_manager.lookup_upc(
                    product_name=lookup['product_name'],
                    retailer_source=lookup['retailer_source'],
                    original_url=lookup['original_url']
                )
                
                if upc_result and upc_result.upc:
                    # success! mark as resolved
                    self.resolve_with_upc(
                        lookup_id=lookup['id'],
                        manual_upc=upc_result.upc,
                        confidence=upc_result.confidence_score,
                        notes=f"Auto-resolved on retry via {upc_result.source_service}"
                    )
                    results["successful"] += 1
                    results["details"].append({
                        "id": lookup['id'],
                        "product_name": lookup['product_name'],
                        "status": "resolved",
                        "upc": upc_result.upc
                    })
                else:
                    # still failed, increment retry count (handled by UPC manager)
                    results["failed"] += 1
                    results["details"].append({
                        "id": lookup['id'],
                        "product_name": lookup['product_name'],
                        "status": "still_failed"
                    })
            
            return {
                "success": True,
                "data": results
            }
            
        except Exception as e:
            self.logger.error(f"Error retrying failed lookups: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"attempted": 0, "successful": 0, "failed": 0, "details": []}
            }
    # search failed lookups by product name
    def search_failed_lookups(self, search_term: str, limit: int = 50) -> Dict[str, Any]:
        try:
            response = self.supabase.table('failed_upc_lookups')\
                .select('*')\
                .ilike('product_name', f'%{search_term}%')\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return {
                "success": True,
                "data": response.data,
                "count": len(response.data)
            }
        except Exception as e:
            self.logger.error(f"Error searching failed lookups: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "count": 0
            }

# factory function to create a FailedUPCManager instance
def create_failed_upc_manager(supabase_client, logger: logging.Logger = None) -> FailedUPCManager:
    return FailedUPCManager(supabase_client=supabase_client, logger=logger) 