-- Migration: Add notification system functions
-- This enables the Python crawler to create notifications and trigger emails

-- Function to create notifications and send emails based on user preferences
CREATE OR REPLACE FUNCTION create_basket_notification(
    p_user_id UUID,
    p_basket_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_listing_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
    user_email TEXT;
    user_name TEXT;
    should_send_email BOOLEAN := FALSE;
    email_result JSON;
BEGIN
    -- Check if user has tracking enabled for this basket and notification type
    IF NOT EXISTS (
        SELECT 1 FROM basket_trackings bt
        WHERE bt.user_id = p_user_id 
        AND bt.basket_id = p_basket_id
        AND (
            (p_notification_type = 'price_drop' AND bt.notify_on_price_drop = TRUE) OR
            (p_notification_type = 'availability' AND bt.notify_on_availability = TRUE) OR
            (p_notification_type = 'changes' AND bt.notify_on_changes = TRUE)
        )
    ) THEN
        RETURN json_build_object('success', false, 'message', 'User not tracking this notification type');
    END IF;

    -- Create the notification record
    INSERT INTO notifications (user_id, title, message, notification_type, listing_id)
    VALUES (p_user_id, p_title, p_message, p_notification_type::notification_type, p_listing_id)
    RETURNING id INTO notification_id;

    -- Check if user wants email notifications
    SELECT 
        u.email,
        COALESCE(u.first_name || ' ' || u.last_name, u.username, 'User') as name,
        COALESCE(np.is_enabled, FALSE)
    INTO user_email, user_name, should_send_email
    FROM users u
    LEFT JOIN notification_preferences np ON (
        np.user_id = u.id 
        AND np.notification_type = 'basket_updates'::notification_type 
        AND np.channel = 'email'::notification_channel
    )
    WHERE u.id = p_user_id;

    -- Send email if enabled
    IF should_send_email AND user_email IS NOT NULL THEN
        SELECT extensions.http((
            'POST',
            current_setting('app.supabase_url') || '/functions/v1/send-notification',
            ARRAY[
                extensions.http_header('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')),
                extensions.http_header('Content-Type', 'application/json')
            ],
            'application/json',
            json_build_object(
                'to', user_email,
                'subject', p_title,
                'html', format(
                    '<h2>%s</h2><p>Hi %s,</p><p>%s</p><hr><p>Best regards,<br>TrackBasket Team</p>',
                    p_title, user_name, p_message
                ),
                'type', p_notification_type
            )::text
        )) INTO email_result;
    END IF;

    RETURN json_build_object(
        'success', true, 
        'notification_id', notification_id,
        'email_sent', should_send_email
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the notification creation
    RAISE WARNING 'Error in create_basket_notification: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to bulk create notifications for multiple users
CREATE OR REPLACE FUNCTION create_bulk_basket_notifications(
    p_notifications JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_item JSON;
    result_item JSON;
    results JSON[] := '{}';
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Process each notification in the array
    FOR notification_item IN SELECT * FROM json_array_elements(p_notifications)
    LOOP
        SELECT create_basket_notification(
            (notification_item->>'user_id')::UUID,
            (notification_item->>'basket_id')::UUID,
            notification_item->>'notification_type',
            notification_item->>'title',
            notification_item->>'message',
            CASE WHEN notification_item->>'listing_id' IS NOT NULL 
                 THEN (notification_item->>'listing_id')::UUID 
                 ELSE NULL END
        ) INTO result_item;

        results := array_append(results, result_item);
        
        IF (result_item->>'success')::BOOLEAN THEN
            success_count := success_count + 1;
        ELSE
            error_count := error_count + 1;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'total_processed', success_count + error_count,
        'successful', success_count,
        'errors', error_count,
        'results', array_to_json(results)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_basket_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_bulk_basket_notifications TO authenticated;

-- Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http; 