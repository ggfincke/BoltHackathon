# // ... existing code ...
#     # crawl multiple grid URLs concurrently (new method for hierarchy file mode)
#     def _crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int) -> None:
#         self.logger.info(f"Starting concurrent grid crawling for {len(grid_urls)} categories with concurrency={concurrency}")
        
#         # run the async concurrent crawl
#         results = self.loop.run_until_complete(
#             self._async_crawl_grids_concurrent(grid_urls, max_pages_per_cat, concurrency)
#         )
        
#         # send results to output backend
#         if results:
#             self.logger.info(f"Collected {len(results)} total items from concurrent crawling")
#             self._out.send(results)
#         else:
#             self.logger.warning("No results collected from concurrent crawling")

#     # async method to crawl multiple grids concurrently
#     async def _async_crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int):
#         # split URLs into batches for processing
#         batch_size = max(1, len(grid_urls) // concurrency)
#         batches = [grid_urls[i:i + batch_size] for i in range(0, len(grid_urls), batch_size)]
        
#         self.logger.info(f"Processing {len(grid_urls)} URLs in {len(batches)} batches")
        
#         # create tasks for each batch
#         tasks = []
#         for i, batch in enumerate(batches):
#             task = asyncio.create_task(
#                 self._process_batch(batch, max_pages_per_cat, i + 1)
#             )
#             tasks.append(task)
        
#         # wait for all batches to complete
#         batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
#         # collect all results
#         all_results = []
#         for i, result in enumerate(batch_results):
#             if isinstance(result, Exception):
#                 self.logger.error(f"Batch {i + 1} failed: {result}")
#             else:
#                 all_results.extend(result)
        
#         return all_results

#     # process a batch of URLs
#     async def _process_batch(self, urls: List[str], max_pages_per_cat: int, batch_num: int):
#         self.logger.info(f"Batch {batch_num}: Processing {len(urls)} URLs")
        
#         # crawl the grid for this batch
#         results = await crawl_grid(
#             start_urls=urls,
#             max_depth=max_pages_per_cat,
#             extract_urls_only=self.urls_only,
#             logger=self.logger
#         )
        
#         self.logger.info(f"Batch {batch_num}: Found {len(results)} items")
#         return results
# // ... existing code ...