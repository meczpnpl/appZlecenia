-- Migracja ustawień z lokalnej bazy do bazy nazwa.pl
-- Wygenerowano dnia: 2025-05-04

-- Usuwanie istniejących ustawień w bazie docelowej (opcjonalne)
-- DELETE FROM settings;

-- Wstawianie ustawień z lokalnej bazy
INSERT INTO settings (category, key, value, value_json, description, created_at, updated_at)
VALUES
('notifications', 'smtp_host', 'ligazzpn.pl', NULL, 'Host serwera SMTP', '2025-05-04 10:03:39.020618', '2025-05-04 10:19:47.542'),
('notifications', 'smtp_port', '465', NULL, 'Port serwera SMTP', '2025-05-04 10:03:39.095454', '2025-05-04 10:03:39.095454'),
('notifications', 'smtp_user', 'info-belpol@ligazzpn.pl', NULL, 'Użytkownik SMTP', '2025-05-04 10:03:39.158569', '2025-05-04 10:03:39.158569'),
('notifications', 'smtp_pass', 'E8R6YBdAJj5qjH', NULL, 'Hasło SMTP', '2025-05-04 10:03:39.218512', '2025-05-04 10:03:39.218512'),
('notifications', 'email_from', 'info-belpol@ligazzpn.pl', NULL, 'Adres nadawcy email', '2025-05-04 10:03:39.278568', '2025-05-04 10:03:39.278568'),
('notifications', 'smtp_secure', 'false', NULL, 'Czy używać bezpiecznego połączenia SSL/TLS', '2025-05-04 10:03:39.33723', '2025-05-04 10:20:07.755'),
('company', 'company_name', 'Bel-Pol', NULL, 'Nazwa firmy', '2025-05-04 10:03:39.396669', '2025-05-04 10:03:39.396669'),
('order', 'order_number_prefix', 'ZM/', NULL, 'Prefiks numeru zlecenia', '2025-05-04 10:03:39.45696', '2025-05-04 10:03:39.45696'),
('order', 'default_order_status', 'złożone', NULL, 'Domyślny status zlecenia', '2025-05-04 10:03:39.517021', '2025-05-04 10:03:39.517021'),
('notifications', 'notify_new_order', 'true', NULL, 'Czy wysyłać powiadomienia o nowych zleceniach', '2025-05-04 10:03:39.574942', '2025-05-04 10:03:39.574942'),
('notifications', 'notify_status_change', 'true', NULL, 'Czy wysyłać powiadomienia o zmianach statusu zlecenia', '2025-05-04 10:03:39.639643', '2025-05-04 10:03:39.639643');