--
-- PostgreSQL database dump
--

\restrict xfZOXuicgJIVp7tKX944uigo4wFV6AmNtVcxr4tyhLb30npyTpGq8GEpRZgozcM

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: blacklist_company(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.blacklist_company(p_company_id bigint, p_company_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO blacklisted_companies (company_id, company_name)
  VALUES (p_company_id, p_company_name)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE incoming_emails SET company_id = NULL WHERE company_id = p_company_id;

  DELETE FROM outreach_campaigns WHERE company_id = p_company_id;

  DELETE FROM companies WHERE id = p_company_id;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    company_name text NOT NULL,
    recipient_email text,
    resume_file text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: blacklisted_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blacklisted_companies (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    company_name text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blacklisted_companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blacklisted_companies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blacklisted_companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blacklisted_companies_id_seq OWNED BY public.blacklisted_companies.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id bigint NOT NULL,
    company_name text NOT NULL,
    source_email_id bigint,
    extraction_confidence numeric,
    hunter_processed boolean DEFAULT false,
    status text DEFAULT 'NEW'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: company_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_emails (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    email text NOT NULL,
    source text DEFAULT 'hunter'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_emails_id_seq OWNED BY public.company_emails.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id bigint NOT NULL,
    campaign_id bigint,
    gmail_message_id text,
    status text,
    error_message text,
    sent_at timestamp with time zone DEFAULT now(),
    gmail_thread_id text,
    send_type text DEFAULT 'INITIAL'::text
);


--
-- Name: email_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_logs_id_seq OWNED BY public.email_logs.id;


--
-- Name: gmail_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_state (
    id bigint NOT NULL,
    gmail_address text NOT NULL,
    last_history_id bigint,
    watch_expiration bigint,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gmail_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gmail_state_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gmail_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gmail_state_id_seq OWNED BY public.gmail_state.id;


--
-- Name: incoming_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incoming_emails (
    id bigint NOT NULL,
    gmail_message_id text NOT NULL,
    gmail_thread_id text,
    sender text,
    receiver text,
    subject text,
    body text,
    snippet text,
    received_at timestamp with time zone,
    keyword_match boolean DEFAULT false,
    ai_processed boolean DEFAULT false,
    company_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    raw_gmail_json jsonb,
    role_type text
);


--
-- Name: incoming_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incoming_emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incoming_emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incoming_emails_id_seq OWNED BY public.incoming_emails.id;


--
-- Name: outreach_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_campaigns (
    id bigint NOT NULL,
    recruiter_email_id bigint,
    email_subject text,
    email_body text,
    resume_url text,
    status text DEFAULT 'PENDING'::text,
    sent_at timestamp with time zone,
    followup_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    company_id bigint,
    last_sent_at timestamp with time zone,
    next_followup_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: outreach_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.outreach_campaigns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outreach_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.outreach_campaigns_id_seq OWNED BY public.outreach_campaigns.id;


--
-- Name: recruiter_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruiter_emails (
    id bigint NOT NULL,
    company_id bigint,
    recruiter_name text,
    recruiter_email text,
    source text,
    confidence numeric,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recruiter_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recruiter_emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recruiter_emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recruiter_emails_id_seq OWNED BY public.recruiter_emails.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blacklisted_companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_companies ALTER COLUMN id SET DEFAULT nextval('public.blacklisted_companies_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: company_emails id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_emails ALTER COLUMN id SET DEFAULT nextval('public.company_emails_id_seq'::regclass);


--
-- Name: email_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs ALTER COLUMN id SET DEFAULT nextval('public.email_logs_id_seq'::regclass);


--
-- Name: gmail_state id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_state ALTER COLUMN id SET DEFAULT nextval('public.gmail_state_id_seq'::regclass);


--
-- Name: incoming_emails id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_emails ALTER COLUMN id SET DEFAULT nextval('public.incoming_emails_id_seq'::regclass);


--
-- Name: outreach_campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns ALTER COLUMN id SET DEFAULT nextval('public.outreach_campaigns_id_seq'::regclass);


--
-- Name: recruiter_emails id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_emails ALTER COLUMN id SET DEFAULT nextval('public.recruiter_emails_id_seq'::regclass);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: blacklisted_companies blacklisted_companies_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_companies
    ADD CONSTRAINT blacklisted_companies_company_id_key UNIQUE (company_id);


--
-- Name: blacklisted_companies blacklisted_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_companies
    ADD CONSTRAINT blacklisted_companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_company_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_company_name_key UNIQUE (company_name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_emails company_emails_company_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_emails
    ADD CONSTRAINT company_emails_company_id_email_key UNIQUE (company_id, email);


--
-- Name: company_emails company_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_emails
    ADD CONSTRAINT company_emails_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: gmail_state gmail_state_gmail_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_state
    ADD CONSTRAINT gmail_state_gmail_address_key UNIQUE (gmail_address);


--
-- Name: gmail_state gmail_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_state
    ADD CONSTRAINT gmail_state_pkey PRIMARY KEY (id);


--
-- Name: incoming_emails incoming_emails_gmail_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_emails
    ADD CONSTRAINT incoming_emails_gmail_message_id_key UNIQUE (gmail_message_id);


--
-- Name: incoming_emails incoming_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_emails
    ADD CONSTRAINT incoming_emails_pkey PRIMARY KEY (id);


--
-- Name: outreach_campaigns outreach_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_pkey PRIMARY KEY (id);


--
-- Name: recruiter_emails recruiter_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_emails
    ADD CONSTRAINT recruiter_emails_pkey PRIMARY KEY (id);


--
-- Name: recruiter_emails recruiter_emails_recruiter_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_emails
    ADD CONSTRAINT recruiter_emails_recruiter_email_key UNIQUE (recruiter_email);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: company_emails_company_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_emails_company_email_uq ON public.company_emails USING btree (company_id, email);


--
-- Name: idx_campaign_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_status ON public.outreach_campaigns USING btree (status);


--
-- Name: idx_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_name ON public.companies USING btree (company_name);


--
-- Name: idx_email_logs_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_campaign_id ON public.email_logs USING btree (campaign_id);


--
-- Name: idx_gmail_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gmail_message ON public.incoming_emails USING btree (gmail_message_id);


--
-- Name: idx_keyword_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keyword_match ON public.incoming_emails USING btree (keyword_match);


--
-- Name: idx_outreach_campaigns_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_campaigns_company_id ON public.outreach_campaigns USING btree (company_id);


--
-- Name: idx_outreach_campaigns_next_followup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_campaigns_next_followup ON public.outreach_campaigns USING btree (next_followup_at);


--
-- Name: idx_outreach_campaigns_recruiter_email_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_campaigns_recruiter_email_id ON public.outreach_campaigns USING btree (recruiter_email_id);


--
-- Name: idx_outreach_campaigns_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_campaigns_user_id ON public.outreach_campaigns USING btree (user_id);


--
-- Name: idx_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed ON public.incoming_emails USING btree (ai_processed);


--
-- Name: idx_recruiter_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recruiter_email ON public.recruiter_emails USING btree (recruiter_email);


--
-- Name: blacklisted_companies blacklist_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_companies
    ADD CONSTRAINT blacklist_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: companies companies_source_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_source_email_id_fkey FOREIGN KEY (source_email_id) REFERENCES public.incoming_emails(id);


--
-- Name: company_emails company_emails_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_emails
    ADD CONSTRAINT company_emails_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: email_logs fk_email_logs_campaign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT fk_email_logs_campaign FOREIGN KEY (campaign_id) REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE;


--
-- Name: incoming_emails fk_incoming_emails_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_emails
    ADD CONSTRAINT fk_incoming_emails_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: outreach_campaigns outreach_campaigns_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: outreach_campaigns outreach_campaigns_recruiter_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_recruiter_email_id_fkey FOREIGN KEY (recruiter_email_id) REFERENCES public.recruiter_emails(id);


--
-- Name: outreach_campaigns outreach_campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recruiter_emails recruiter_emails_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_emails
    ADD CONSTRAINT recruiter_emails_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: blacklisted_companies anon_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_delete ON public.blacklisted_companies FOR DELETE USING (true);


--
-- Name: companies anon_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_delete ON public.companies FOR DELETE USING (true);


--
-- Name: company_emails anon_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_delete ON public.company_emails FOR DELETE USING (true);


--
-- Name: applications anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.applications FOR INSERT WITH CHECK (true);


--
-- Name: blacklisted_companies anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.blacklisted_companies FOR INSERT WITH CHECK (true);


--
-- Name: companies anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.companies FOR INSERT WITH CHECK (true);


--
-- Name: company_emails anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.company_emails FOR INSERT WITH CHECK (true);


--
-- Name: email_logs anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.email_logs FOR INSERT WITH CHECK (true);


--
-- Name: gmail_state anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.gmail_state FOR INSERT WITH CHECK (true);


--
-- Name: incoming_emails anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.incoming_emails FOR INSERT WITH CHECK (true);


--
-- Name: outreach_campaigns anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.outreach_campaigns FOR INSERT WITH CHECK (true);


--
-- Name: recruiter_emails anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.recruiter_emails FOR INSERT WITH CHECK (true);


--
-- Name: users anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert ON public.users FOR INSERT WITH CHECK (true);


--
-- Name: applications anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.applications FOR SELECT USING (true);


--
-- Name: blacklisted_companies anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.blacklisted_companies FOR SELECT USING (true);


--
-- Name: companies anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.companies FOR SELECT USING (true);


--
-- Name: company_emails anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.company_emails FOR SELECT USING (true);


--
-- Name: email_logs anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.email_logs FOR SELECT USING (true);


--
-- Name: gmail_state anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.gmail_state FOR SELECT USING (true);


--
-- Name: incoming_emails anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.incoming_emails FOR SELECT USING (true);


--
-- Name: outreach_campaigns anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.outreach_campaigns FOR SELECT USING (true);


--
-- Name: recruiter_emails anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.recruiter_emails FOR SELECT USING (true);


--
-- Name: users anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.users FOR SELECT USING (true);


--
-- Name: companies anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update ON public.companies FOR UPDATE USING (true);


--
-- Name: gmail_state anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update ON public.gmail_state FOR UPDATE USING (true);


--
-- Name: outreach_campaigns anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update ON public.outreach_campaigns FOR UPDATE USING (true);


--
-- Name: users anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update ON public.users FOR UPDATE USING (true);


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: blacklisted_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blacklisted_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_state ENABLE ROW LEVEL SECURITY;

--
-- Name: incoming_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incoming_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: recruiter_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruiter_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict xfZOXuicgJIVp7tKX944uigo4wFV6AmNtVcxr4tyhLb30npyTpGq8GEpRZgozcM

