ALTER TABLE checkout_orders ADD COLUMN stripe_payment_intent TEXT;
ALTER TABLE checkout_orders ADD COLUMN stripe_customer TEXT;
ALTER TABLE billing_entitlements ADD COLUMN stripe_order_id TEXT;
ALTER TABLE billing_entitlements ADD COLUMN period_start INTEGER;
CREATE INDEX billing_entitlements_orders ON billing_entitlements(stripe_order_id);
CREATE INDEX checkout_payment_ref ON checkout_orders(stripe_payment_intent);
