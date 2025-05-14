--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: photos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sales_plans; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (2, 'notifications', 'smtp_port', '465', NULL, 'Port serwera SMTP', '2025-05-04 10:03:39.095454', '2025-05-04 10:03:39.095454');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (3, 'notifications', 'smtp_user', 'info-belpol@ligazzpn.pl', NULL, 'Użytkownik SMTP', '2025-05-04 10:03:39.158569', '2025-05-04 10:03:39.158569');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (4, 'notifications', 'smtp_pass', 'E8R6YBdAJj5qjH', NULL, 'Hasło SMTP', '2025-05-04 10:03:39.218512', '2025-05-04 10:03:39.218512');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (5, 'notifications', 'email_from', 'info-belpol@ligazzpn.pl', NULL, 'Adres nadawcy email', '2025-05-04 10:03:39.278568', '2025-05-04 10:03:39.278568');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (7, 'company', 'company_name', 'Bel-Pol', NULL, 'Nazwa firmy', '2025-05-04 10:03:39.396669', '2025-05-04 10:03:39.396669');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (8, 'order', 'order_number_prefix', 'ZM/', NULL, 'Prefiks numeru zlecenia', '2025-05-04 10:03:39.45696', '2025-05-04 10:03:39.45696');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (9, 'order', 'default_order_status', 'złożone', NULL, 'Domyślny status zlecenia', '2025-05-04 10:03:39.517021', '2025-05-04 10:03:39.517021');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (10, 'notifications', 'notify_new_order', 'true', NULL, 'Czy wysyłać powiadomienia o nowych zleceniach', '2025-05-04 10:03:39.574942', '2025-05-04 10:03:39.574942');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (11, 'notifications', 'notify_status_change', 'true', NULL, 'Czy wysyłać powiadomienia o zmianach statusu zlecenia', '2025-05-04 10:03:39.639643', '2025-05-04 10:03:39.639643');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (1, 'notifications', 'smtp_host', 'ligazzpn.pl', NULL, 'Host serwera SMTP', '2025-05-04 10:03:39.020618', '2025-05-04 10:19:47.542');
INSERT INTO public.settings (id, category, key, value, value_json, description, created_at, updated_at) VALUES (6, 'notifications', 'smtp_secure', 'false', NULL, 'Czy używać bezpiecznego połączenia SSL/TLS', '2025-05-04 10:03:39.33723', '2025-05-04 10:20:07.755');


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, email, password, name, phone, role, store_id, store, "position", company_id, company_name, nip, company_address, services, company_owner_only, created_at, updated_at) VALUES (1, 'tomekarso@gmail.com', '$2b$10$dygWHjxbaPgeTAufrXddwu1dJx897RCLZsQKSgeNT67giX4lwlko2', 'Tomek Arso', NULL, 'admin', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', true, '2025-05-04 10:17:52.666', '2025-05-04 10:17:52.666');


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.companies_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.photos_id_seq', 1, false);


--
-- Name: sales_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_plans_id_seq', 1, false);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 11, true);


--
-- Name: stores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stores_id_seq', 1, false);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- PostgreSQL database dump complete
--

