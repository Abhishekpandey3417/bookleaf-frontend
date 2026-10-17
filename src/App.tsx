import { useCallback, useEffect, useState } from 'react'; import { useNavigate } from 'react-router-dom'; import axios from 'axios'; import { io } from 'socket.io-client'; import { BookOpen, LayoutDashboard, Ticket, PlusCircle, LogOut, Search, RefreshCw, Send, Sparkles, Users, CircleAlert, CheckCircle2, Clock3, Leaf, ArrowUpRight } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:6000/api', SOCKET = import.meta.env.VITE_SOCKET_URL || 'http://localhost:6000'; const client = axios.create({ baseURL: API }); client.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c });
type User = { id: string, name: string, email: string, role: 'AUTHOR' | 'ADMIN' }; type Book = any; type TicketType = any;
export default function App() {
  const [me, setMe] = useState<User | null>(JSON.parse(localStorage.getItem('user') || 'null')); const [page, setPage] = useState('Dashboard'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [books, setBooks] = useState<Book[]>([]); const [tickets, setTickets] = useState<TicketType[]>([]); const [stats, setStats] = useState<any>({}); const [active, setActive] = useState<any>(null); const [messages, setMessages] = useState<any[]>([]); const [draftCooldown, setDraftCooldown] = useState(0); const [loginEmail, setLoginEmail] = useState(''); const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(''); const [toast, setToast] = useState(''); const [reply, setReply] = useState(''); const [isInternal, setIsInternal] = useState(false); const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [bookId, setBookId] = useState(''); const [authors, setAuthors] = useState<any[]>([]); const nav = useNavigate(); const admin = me?.role === 'ADMIN';
  const load = useCallback(async () => { if (!me) return; try { const [s, b, t] = await Promise.all([client.get('/dashboard'), client.get('/books'), client.get('/tickets')]); setStats(s.data); setBooks(b.data); setTickets(t.data); } catch (e: any) { setError(e.response?.data?.error || 'Could not load data') } }, [me]); useEffect(() => { if (me) load() }, [me, load]); useEffect(() => { if (!me) return; const socket = io(SOCKET); socket.on('ticket:updated', () => load()); socket.on('ticket:created', () => load()); return () => { socket.disconnect() } }, [me, load]); useEffect(() => { if (admin && page === 'Authors') client.get('/admin/authors').then(r => setAuthors(r.data)).catch(() => { }) }, [admin, page]);

  // Countdown for draft cooldown
  useEffect(() => {
    if (draftCooldown <= 0) return;
    const timer = setInterval(() => {
      setDraftCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [draftCooldown]);
  const login = async (e: any) => { e.preventDefault(); setBusy(true); setError(''); try { const r = await client.post('/auth/login', { email: loginEmail, password }); localStorage.setItem('token', r.data.token); localStorage.setItem('user', JSON.stringify(r.data.user)); setMe(r.data.user); setPage('Dashboard') } catch (e: any) { setError(e.response?.data?.error || 'Unable to sign in') } finally { setBusy(false) } }; const logout = () => { localStorage.clear(); setMe(null); setActive(null); setPage('Dashboard'); nav('/') };
  const registerAuthor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      await client.post('/auth/register', {
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
      });

      setLoginEmail(registerEmail.trim());
      setPassword('');
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setAuthMode('login');
      setError('Account created successfully. Please sign in.');
    } catch (e: any) {
      setError(
        e.response?.data?.error || 'Unable to create your account.'
      );
    } finally {
      setBusy(false);
    }
  };
  const openTicket = async (t: any) => { try { const r = await client.get(`/tickets/${t.id}`); setActive(r.data.ticket); setMessages(r.data.messages); setReply(''); setIsInternal(false); setPage('Ticket details') } catch (e: any) { setError(e.response?.data?.error || 'Could not open ticket') } };
  const createTicket = async (e: any) => { e.preventDefault(); setBusy(true); setError(''); try { const r = await client.post('/tickets', { bookId: bookId || null, subject, description }); setToast(`Ticket created · ${r.data.priority} priority`); setSubject(''); setDescription(''); setBookId(''); setPage('My Tickets'); await load() } catch (e: any) { setError(e.response?.data?.error || 'Could not create ticket') } finally { setBusy(false) } };
  const sendReply = async () => { if (!reply.trim() || !active) return; setBusy(true); try { await client.post(`/tickets/${active.id}/messages`, { body: reply, isInternal }); setReply(''); const r = await client.get(`/tickets/${active.id}`); setMessages(r.data.messages); setActive(r.data.ticket); setToast(isInternal ? 'Internal note added' : 'Response sent'); await load() } catch (e: any) { setError(e.response?.data?.error || 'Could not send response') } finally { setBusy(false) } };
  const updateTicket = async (p: any) => { try { await client.patch(`/tickets/${active.id}`, p); const r = await client.get(`/tickets/${active.id}`); setActive(r.data.ticket); setMessages(r.data.messages); await load(); setToast('Ticket updated') } catch (e: any) { setError(e.response?.data?.error || 'Update failed') } };
  const generateDraft = async () => {
    try {
      setBusy(true);
      setError('');
      const r = await client.post(`/tickets/${active.id}/draft`);
      setReply(r.data.draft);
      setIsInternal(false);
      if (r.data.warning) {
        setToast(r.data.warning);
      } else if (r.data.remaining !== undefined) {
        setToast(`AI draft generated · ${r.data.remaining} requests left this hour`);
      }
    } catch (e: any) {
      const status = e.response?.status;
      if (status === 429) {
        const errorMsg = e.response?.data?.error;
        if (errorMsg) {
          setError(errorMsg);
        } else {
          const retryAfter = parseInt(e.response?.headers?.['retry-after'] || '3600', 10);
          const mins = Math.ceil(retryAfter / 60);
          setError(`Rate limit reached (30/30 requests used). Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
        }
      } else {
        setError(e.response?.data?.error || 'Could not generate draft');
      }
    } finally {
      setBusy(false);
    }
  };
  if (!me) return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand">
          <span className="brand-icon"><Leaf /></span>
          <span>bookleaf<span className="brand-dot">.</span></span>
        </div>

        <div className="art-copy">
          <span className="eyebrow">YOUR AUTHOR JOURNEY</span>
          <h1>Every story<br />deserves to be<br /><em>heard.</em></h1>
          <p>Your books, your royalties, your support team. Everything you need, in one place.</p>
          <div className="art-bottom">
            <BookOpen size={18} /> Made for the people behind every page.
          </div>
        </div>

        <div className="art-circle circle-one" />
        <div className="art-circle circle-two" />
      </div>

      <div className="login-panel">
        <form
          className="login-form"
          onSubmit={authMode === 'login' ? login : registerAuthor}
        >
          <span className="eyebrow green">
            {authMode === 'login' ? 'WELCOME BACK' : 'JOIN BOOKLEAF'}
          </span>

          <h2>
            {authMode === 'login'
              ? 'Sign in to BookLeaf'
              : 'Create your author account'}
          </h2>

          <p className="muted">
            {authMode === 'login'
              ? 'Access your author dashboard and support tickets.'
              : 'Register to manage your books and support tickets.'}
          </p>

          {authMode === 'register' && (
            <>
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                placeholder="Reddy Kumar"
              />
            </>
          )}

          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            value={authMode === 'login' ? loginEmail : registerEmail}
            onChange={e =>
              authMode === 'login'
                ? setLoginEmail(e.target.value)
                : setRegisterEmail(e.target.value)
            }
            required
            maxLength={254}
            placeholder="you@example.com"
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={authMode === 'login' ? password : registerPassword}
            onChange={e =>
              authMode === 'login'
                ? setPassword(e.target.value)
                : setRegisterPassword(e.target.value)
            }
            required
            minLength={authMode === 'register' ? 8 : undefined}
            maxLength={72}
            placeholder={
              authMode === 'login'
                ? 'Enter your password'
                : 'At least 8 characters'
            }
          />

          <button className="primary full" disabled={busy}>
            {busy
              ? 'Please wait...'
              : authMode === 'login'
                ? 'Sign in to your account'
                : 'Create author account'}
            <ArrowUpRight size={17} />
          </button>

          {error && (
            <div className="error" role="status">
              {error}
            </div>
          )}

          <p className="login-foot">
            {authMode === 'login'
              ? "Don't have an account? "
              : 'Already registered? '}

            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setAuthMode(
                  authMode === 'login' ? 'register' : 'login'
                );
                setError('');
              }}
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {authMode === 'login' && (
            <div className="demo-box">
              <strong>Demo accounts</strong>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail('priya.sharma@email.com');
                  setPassword('Author@12345');
                }}
              >
                Author demo
                <span>priya.sharma@email.com</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail('admin@bookleaf.test');
                  setPassword('Admin@12345');
                }}
              >
                Admin demo
                <span>admin@bookleaf.test</span>
              </button>
            </div>
          )}

          <p className="login-foot">
            Secure access · BookLeaf Publishing
          </p>
        </form>
      </div>
    </div>
  );
  const navItems = admin ? [['Dashboard', LayoutDashboard], ['Ticket Queue', Ticket], ['Authors', Users]] : [['Dashboard', LayoutDashboard], ['My Books', BookOpen], ['My Tickets', Ticket], ['Submit a Query', PlusCircle]];
  const visible = tickets
    .filter(t => {
      const matchesStatus =
        filter === 'All' || t.status === filter;

      const matchesCategory =
        categoryFilter === 'All' ||
        t.category === categoryFilter;

      const matchesPriority =
        priorityFilter === 'All' ||
        t.priority === priorityFilter;

      const searchText =
        `${t.subject || ''} ${t.description || ''} ${t.author_name || ''
          } ${t.author_email || ''} ${t.book_title || ''} ${t.id || ''
          }`.toLowerCase();

      const matchesSearch =
        searchText.includes(search.toLowerCase().trim());

      const createdAt = new Date(t.created_at);
      const matchesDateFrom =
        !dateFrom ||
        createdAt >= new Date(`${dateFrom}T00:00:00`);

      const matchesDateTo =
        !dateTo ||
        createdAt < new Date(
          new Date(`${dateTo}T00:00:00`).getTime() +
          24 * 60 * 60 * 1000
        );

      return (
        matchesStatus &&
        matchesCategory &&
        matchesPriority &&
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo
      );
    })
    .sort((a, b) => {
      const isUnresolvedA =
        !['Resolved', 'Closed'].includes(a.status);

      const isUnresolvedB =
        !['Resolved', 'Closed'].includes(b.status);

      if (isUnresolvedA !== isUnresolvedB) {
        return isUnresolvedA ? -1 : 1;
      }

      const priorityRank: Record<string, number> = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3,
      };

      const priorityDifference =
        (priorityRank[a.priority] ?? 4) -
        (priorityRank[b.priority] ?? 4);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
      );
    }); const currency = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); const statusClass = (s: string) => (s || 'open').toLowerCase().replace(/ /g, '-');
  return <div className="app-shell"><aside className="sidebar"><div className="brand side-brand"><span className="brand-icon"><Leaf /></span><span>bookleaf<span className="brand-dot">.</span></span></div><div className="workspace"><div className="avatar">{me.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</div><div><strong>{admin ? 'Operations desk' : 'Author workspace'}</strong><small>{admin ? 'Support team' : 'BookLeaf Publishing'}</small></div></div><div className="nav-label">WORKSPACE</div><nav>{navItems.map(([name, Icon]: any) => <button key={name} className={`nav-item ${page === name ? 'selected' : ''}`} onClick={() => { setPage(name); setActive(null); setError('') }}><Icon size={18} />{name}{name === 'Ticket Queue' && stats.open > 0 && <span className="nav-count">{stats.open}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Sparkles size={17} /></div><strong>Need a hand?</strong><p>{admin ? 'Keep every author moving forward.' : 'Our support team is here to help with your publishing journey.'}</p>{!admin && <button onClick={() => setPage('Submit a Query')}>Contact support <ArrowUpRight size={14} /></button>}</div><button className="profile" onClick={logout}><div className="avatar small">{me.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</div><div className="profile-info"><strong>{me.name}</strong><small>{admin ? 'Administrator' : 'Author account'}</small></div><LogOut size={17} /></button></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{page === 'Ticket details' ? 'Ticket details' : page}</strong></div><div className="top-right">
      <span className="live-dot" />
      Support portal operational
      <div className="top-avatar">{me.name[0]}</div>
    </div></header><div className="content"><div className="welcome-row"><div><div className="eyebrow green">{admin ? 'SUPPORT OPERATIONS' : 'BOOKLEAF AUTHOR PORTAL'}</div><h1>{page === 'Dashboard' ? (admin ? 'Support overview' : `Good to see you, ${me.name.split(' ')[0]}.`) : page === 'Ticket details' ? active?.subject : page}</h1><p className="muted">{page === 'Dashboard' ? (admin ? 'A clear view of every author conversation.' : 'Your publishing journey, all in one place.') : page === 'My Books' ? 'Every title, every milestone, all together.' : page === 'My Tickets' ? 'Track your conversations with the BookLeaf team.' : page === 'Submit a Query' ? 'Tell us what you need help with. We’re listening.' : page === 'Ticket Queue' ? 'Prioritize, respond, and keep authors moving forward.' : page === 'Authors' ? 'Author accounts and their support activity.' : 'Review the conversation and take the next step.'}</p></div>{page === 'Dashboard' && !admin && <button className="primary" onClick={() => setPage('Submit a Query')}><PlusCircle size={17} /> New support ticket</button>}{(page === 'Ticket Queue' || page === 'My Tickets') && <button className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>}</div>
        {error && <div className="error banner" onClick={() => setError('')}>{error} <span>×</span></div>}{toast && <div className="toast" onClick={() => setToast('')}><CheckCircle2 size={16} />{toast}<span>×</span></div>}
        {page === 'Dashboard' && <>{admin ? <><div className="stat-grid"><Stat icon={Ticket} label="Total tickets" value={stats.total || 0} note="Across all authors" /><Stat icon={Clock3} label="Open tickets" value={stats.open || 0} note="Awaiting attention" /><Stat icon={CircleAlert} label="Urgent tickets" value={stats.urgent || 0} note="Critical or high priority" /><Stat icon={CheckCircle2} label="Resolved" value={stats.resolved || 0} note="Successfully handled" /></div><div className="section-head"><div><h3>Needs attention</h3><p>Urgent and oldest unresolved tickets first.</p></div><button className="text-button" onClick={() => setPage('Ticket Queue')}>View all tickets <ArrowUpRight size={15} /></button></div><TicketTable tickets={tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).slice(0, 6)} admin onOpen={openTicket} statusClass={statusClass} /></> : <><div className="hero-card"><div><span className="hero-label">YOUR CREATIVE WORK, IN NUMBERS</span><h2>Your words are<br />making an impact.</h2><p>Here's how your books are doing so far.</p></div><div className="hero-book"><BookOpen size={45} /><span>YOUR STORY<br />CONTINUES</span></div><div className="hero-scribble">✳</div></div><div className="stat-grid four"><Stat icon={BookOpen} label="Published titles" value={stats.books || 0} note="In your catalogue" /><Stat icon={ArrowUpRight} label="Copies sold" value={Number(stats.sales || 0).toLocaleString('en-IN')} note="Across all platforms" /><Stat icon={CheckCircle2} label="Royalty earned" value={currency(stats.earned)} note="Total to date" /><Stat icon={Clock3} label="Royalty pending" value={currency(stats.pending)} note="Awaiting payout" /></div><div className="section-head"><div><h3>Your recent support tickets</h3><p>Stay up to date with your conversations.</p></div><button className="text-button" onClick={() => setPage('My Tickets')}>All tickets <ArrowUpRight size={15} /></button></div>{tickets.length ? <TicketTable tickets={tickets.slice(0, 5)} onOpen={openTicket} statusClass={statusClass} /> : <Empty title="No support tickets yet" text="If you need help with a book or royalty, our team is here." action="Submit a query" onAction={() => setPage('Submit a Query')} />}</>}</>}
        {(page === 'My Books') && <><div className="stat-grid four"><Stat icon={BookOpen} label="Total titles" value={books.length} note="Published and in production" /><Stat icon={ArrowUpRight} label="Copies sold" value={books.reduce((n, b) => n + Number(b.total_copies_sold || 0), 0).toLocaleString('en-IN')} note="Across all books" /><Stat icon={CheckCircle2} label="Royalty paid" value={currency(books.reduce((n, b) => n + Number(b.royalty_paid || 0), 0))} note="Paid to date" /><Stat icon={Clock3} label="Pending royalty" value={currency(books.reduce((n, b) => n + Number(b.royalty_pending || 0), 0))} note="Across all books" /></div><div className="book-grid">{books.map(b => <div className="book-card" key={b.id}><div className="book-cover"><BookOpen size={30} /><span>{b.genre || 'BOOK'}</span></div><div className="book-body"><span className={`pill ${statusClass(b.status).includes('published') ? 'resolved' : 'progress'}`}>{b.status}</span><h3>{b.title}</h3><p className="book-isbn">ISBN {b.isbn || 'Not assigned'}</p><div className="book-meta"><span>Copies sold</span><strong>{Number(b.total_copies_sold || 0).toLocaleString('en-IN')}</strong></div><div className="book-meta"><span>Royalty earned</span><strong>{currency(b.total_royalty_earned)}</strong></div><div className="book-meta"><span>Paid</span><strong>{currency(b.royalty_paid)}</strong></div><div className="book-meta pending"><span>Pending</span><strong>{currency(b.royalty_pending)}</strong></div><button className="secondary book-help" onClick={() => { setBookId(b.id); setPage('Submit a Query') }}>Ask about this book <ArrowUpRight size={14} /></button></div></div>)}</div></>}
        {(page === 'My Tickets' || page === 'Ticket Queue') && (
          <>
            <div className="filter-bar">
              <div className="searchbox">
                <Search size={17} />
                <input
                  placeholder="Search tickets, authors, books, or ticket ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="All">All statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              {admin && (
                <>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    aria-label="Filter by category"
                  >
                    <option value="All">All categories</option>
                    <option>Royalty &amp; Payments</option>
                    <option>ISBN &amp; Metadata Issues</option>
                    <option>Printing &amp; Quality</option>
                    <option>Distribution &amp; Availability</option>
                    <option>Book Status &amp; Production Updates</option>
                    <option>General Inquiry</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value)}
                    aria-label="Filter by priority"
                  >
                    <option value="All">All priorities</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>

                  <label>
                    From
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      aria-label="Tickets created from"
                    />
                  </label>

                  <label>
                    To
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={e => setDateTo(e.target.value)}
                      aria-label="Tickets created to"
                    />
                  </label>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setFilter('All');
                      setCategoryFilter('All');
                      setPriorityFilter('All');
                      setDateFrom('');
                      setDateTo('');
                      setSearch('');
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}

              <span className="result-count">
                {visible.length} tickets
              </span>
            </div>

            <TicketTable
              tickets={admin ? visible : visible.filter(
                t => t.author_id === me.id
              )}
              admin={admin}
              onOpen={openTicket}
              statusClass={statusClass}
            />
          </>
        )}
        {page === 'Submit a Query' && <div className="form-card"><div className="form-intro"><div className="form-icon"><Send size={20} /></div><h3>How can we help?</h3><p>Share a few details and the right person on our team will take a look.</p></div><form onSubmit={createTicket}><label>Which book is this about?</label><select value={bookId} onChange={e => setBookId(e.target.value)}><option value="">General / Account Level</option>{books.map(b => <option value={b.id} key={b.id}>{b.title}</option>)}</select><label>Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} required minLength={3} maxLength={180} placeholder="Briefly describe what you need help with" /><label>Tell us more</label><textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={10} maxLength={6000} rows={6} placeholder="Include any details that will help us understand the issue..." /><div className="form-hint">Our AI assistant categorizes and prioritizes your ticket so it reaches the right team. An admin reviews every response.</div><button className="primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit support ticket'} <ArrowUpRight size={16} /></button></form></div>}
        {page === 'Ticket details' && active && <div className="ticket-detail"><button className="text-button back" onClick={() => setPage(admin ? 'Ticket Queue' : 'My Tickets')}>← Back to tickets</button><div className="detail-head"><div><div className="ticket-id">TICKET · {active.id.slice(0, 8).toUpperCase()}</div><h2>{active.subject}</h2><p className="muted">Submitted {new Date(active.created_at).toLocaleString()} {active.book_title && ` · ${active.book_title}`}</p></div><span className={`pill ${statusClass(active.status)}`}>{active.status}</span></div><div className="detail-layout"><section className="conversation"><div className="message original"><div className="message-head"><div className="avatar small">{(active.author_name || me.name)[0]}</div><div><strong>{active.author_name || me.name}</strong><small>Original query · {new Date(active.created_at).toLocaleString()}</small></div><span className="pill open">Author</span></div><p>{active.description}</p></div>{messages.map(m => <div className={`message ${m.is_internal ? 'internal' : ''}`} key={m.id}><div className="message-head"><div className="avatar small">{(m.sender_name || 'B')[0]}</div><div><strong>{m.sender_name}</strong><small>{m.is_internal ? 'Internal note' : m.sender_role === 'ADMIN' ? 'BookLeaf Support' : 'Author'} · {new Date(m.created_at).toLocaleString()}</small></div></div><p>{m.body}</p></div>)}<div className="reply-box"><div className="reply-top"><strong>{admin ? 'Reply to author' : 'Add a message'}</strong>{admin && <label className="check-label"><input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} /> Internal note</label>}</div>{admin && <button className="secondary ai-button" onClick={generateDraft} disabled={busy || draftCooldown > 0}><Sparkles size={15} /> {busy ? 'Generating...' : 'Draft with AI'}</button>}<textarea rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder={isInternal ? 'Internal note, only visible to the support team...' : 'Write your message...'} /><button className="primary" onClick={sendReply} disabled={busy || !reply.trim()}>{isInternal ? 'Add internal note' : 'Send response'} <Send size={15} /></button></div></section>{admin && <aside className="ticket-sidebar"><h3>Ticket details</h3><label>Status</label><select value={active.status} onChange={e => updateTicket({ status: e.target.value })}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select><label>Priority</label><select value={active.priority} onChange={e => updateTicket({ priority: e.target.value })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select><label>Category</label><select value={active.category} onChange={e => updateTicket({ category: e.target.value })}>{['Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'].map(c => <option key={c} value={c}>{c}</option>)}</select><button className="secondary full" onClick={() => updateTicket({ assignToMe: true })}>Assign to me</button><div className="author-mini"><span className="eyebrow">AUTHOR</span><strong>{active.author_name}</strong><small>{active.author_email}</small><span className="eyebrow">BOOK</span><strong>{active.book_title || 'General / Account Level'}</strong></div><div className="ai-note"><Sparkles size={15} /><div><strong>AI-assisted support</strong><p>Category and priority can be reviewed and overridden by the team.</p></div></div></aside>}</div></div>}
        {page === 'Authors' && <div className="table-card"><table><thead><tr><th>AUTHOR</th><th>LOCATION</th><th>BOOKS</th><th>TICKETS</th></tr></thead><tbody>{authors.map(a => <tr key={a.id}><td><div className="author-cell"><div className="avatar small">{a.name[0]}</div><div><strong>{a.name}</strong><small>{a.email}</small></div></div></td><td>{a.city || '—'}</td><td>{a.book_count}</td><td>{a.ticket_count}</td></tr>)}</tbody></table>{!authors.length && <Empty title="No authors found" text="Author records will appear here." />}</div>}
      </div><footer className="footer"><span>© 2026 BookLeaf Publishing</span><span>Made for authors, with care <Leaf size={13} /></span></footer></main ></div >
}
function Stat({ icon: Icon, label, value, note }: any) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} /></div></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }
function TicketTable({ tickets, admin, onOpen, statusClass }: any) { return <div className="table-card"><table><thead><tr><th>SUBJECT</th>{admin && <th>AUTHOR</th>}<th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th>UPDATED</th></tr></thead><tbody>{tickets.map((t: any) => <tr key={t.id} onClick={() => onOpen(t)} className="click-row"><td><div className="ticket-subject"><strong>{t.subject}</strong><small>{t.book_title || 'General / Account Level'} · #{t.id.slice(0, 7)}</small></div></td>{admin && <td><div className="author-cell"><div className="avatar tiny">{(t.author_name || '?')[0]}</div><div><strong>{t.author_name}</strong><small>{t.author_email}</small></div></div></td>}<td><span className="category-text">{t.category}</span></td><td><span className={`priority ${statusClass(t.priority)}`}><i />{t.priority}</span></td><td><span className={`pill ${statusClass(t.status)}`}>{t.status}</span></td><td className="date-cell">{new Date(t.updated_at || t.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!tickets.length && <Empty title="Nothing here just yet" text="When tickets come in, they’ll show up here." />}</div> }
function Empty({ title, text, action, onAction }: any) { return <div className="empty"><div className="empty-icon"><Ticket size={22} /></div><h3>{title}</h3><p>{text}</p>{action && <button className="primary" onClick={onAction}>{action}</button>}</div> }
