-- seed data for retailers table
INSERT INTO retailers (id, name, slug, description, logo_url, website_url, is_active, created_at, updated_at) 
VALUES 
    -- Amazon (crawler expects retailer_id = 1)
    ('00000000-0000-0000-0000-000000000001', 'Amazon', 'amazon', 'Amazon.com - Online shopping for Electronics, Apparel, Computers, Books, DVDs & more', NULL, 'https://www.amazon.com', TRUE, NOW(), NOW()),
    
    -- Target (crawler expects retailer_id = 2)  
    ('00000000-0000-0000-0000-000000000002', 'Target', 'target', 'Target Corporation - Expect More. Pay Less.', NULL, 'https://www.target.com', TRUE, NOW(), NOW()),
    
    -- Walmart (crawler expects retailer_id = 3)
    ('00000000-0000-0000-0000-000000000003', 'Walmart', 'walmart', 'Walmart Inc. - Save Money. Live Better.', NULL, 'https://www.walmart.com', TRUE, NOW(), NOW())

ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    website_url = EXCLUDED.website_url,
    is_active = EXCLUDED.is_active,
    updated_at = NOW(); 