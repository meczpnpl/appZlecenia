-- Skrypt do wyczyszczenia wszystkich tabel w bazie danych nazwa.pl
-- Wyłączamy tymczasowo ograniczenia kluczy obcych
SET session_replication_role = 'replica';

-- Usuwamy dane ze wszystkich tabel
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE stores CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE sales_plans CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE photos CASCADE;
TRUNCATE TABLE settings CASCADE;

-- Resetujemy sekwencje
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE stores_id_seq RESTART WITH 1;
ALTER SEQUENCE companies_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE sales_plans_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE subscriptions_id_seq RESTART WITH 1;
ALTER SEQUENCE photos_id_seq RESTART WITH 1;
ALTER SEQUENCE settings_id_seq RESTART WITH 1;

-- Przywracamy ograniczenia kluczy obcych
SET session_replication_role = 'origin';