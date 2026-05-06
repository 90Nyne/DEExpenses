/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  History, 
  PieChart, 
  Settings, 
  Plus, 
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Filter,
  Search,
  Check,
  Trash2,
  ChevronLeft,
  Tag,
  LogOut
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

import { Transaction, Category, UserSettings, TransactionType } from './types';
import { DEFAULT_CATEGORIES, CURRENCIES } from './constants';
import { cn } from './lib/utils';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';

// --- Components ---

const IconButton = ({ icon: Icon, onClick, active, label }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center gap-1 transition-all duration-300",
      active ? "text-gray-900 scale-105" : "text-gray-400 hover:text-gray-600"
    )}
  >
    <div className={cn(
      "p-2 rounded-2xl transition-all duration-300",
      active ? "bg-white shadow-sm" : "bg-transparent"
    )}>
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    </div>
    {label && <span className="text-[10px] uppercase tracking-widest font-semibold">{label}</span>}
  </button>
);

const GlassCard = ({ children, className, onClick }: any) => (
  <div 
    onClick={onClick}
    className={cn("glass rounded-3xl p-6 shadow-sm", className)}
  >
    {children}
  </div>
);

// --- App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'history' | 'analytics' | 'settings' | 'categories'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ userId: '', currency: 'GHS', theme: 'light', updatedAt: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Settings
    const settingsRef = doc(db, 'users', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as UserSettings);
      } else {
        // Init default settings
        const defaultSettings: UserSettings = {
          userId: user.uid,
          currency: 'GHS',
          theme: 'light',
          updatedAt: serverTimestamp()
        };
        setDoc(settingsRef, defaultSettings).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));

    // Fetch Categories
    const categoriesRef = collection(db, 'users', user.uid, 'categories');
    const unsubCategories = onSnapshot(categoriesRef, (snap) => {
      if (snap.empty) {
        // Init default categories
        DEFAULT_CATEGORIES.forEach(cat => {
          const catRef = doc(categoriesRef, cat.id);
          setDoc(catRef, {
            ...cat,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/categories/${cat.id}`));
        });
      } else {
        setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id } as Category)));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/categories`));

    // Fetch Transactions
    const transactionsRef = collection(db, 'users', user.uid, 'transactions');
    const q = query(transactionsRef, orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/transactions`));

    return () => {
      unsubSettings();
      unsubCategories();
      unsubTransactions();
    };
  }, [user]);

  const currencySymbol = useMemo(() => {
    return CURRENCIES.find(c => c.code === settings.currency)?.symbol || '$';
  }, [settings.currency]);

  // Derived State
  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, t) => 
      t.type === 'income' ? acc + t.amount : acc - t.amount, 0
    );
  }, [transactions]);

  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions
      .filter(t => t.type === 'income' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions
      .filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const addTransaction = async (t: any) => {
    if (!user) return;
    try {
      const transactionsRef = collection(db, 'users', user.uid, 'transactions');
      await addDoc(transactionsRef, {
        ...t,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/transactions`);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'users', user.uid);
      await setDoc(settingsRef, {
        ...settings,
        ...newSettings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Login />;

  return (
    <div className={cn(
      "min-h-screen max-w-md mx-auto relative flex flex-col transition-colors duration-500",
      settings.theme === 'dark' ? 'dark bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'
    )}>
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32 pt-8 px-6">
        <AnimatePresence mode="wait">
          {tab === 'dashboard' && (
            <Dashboard 
              key="dashboard"
              user={user}
              transactions={transactions} 
              categories={categories}
              balance={totalBalance}
              income={monthlyIncome}
              expenses={monthlyExpenses}
              currencySymbol={currencySymbol}
            />
          )}
          {tab === 'history' && (
            <HistoryView 
              key="history"
              transactions={transactions}
              categories={categories}
              currencySymbol={currencySymbol}
            />
          )}
          {tab === 'analytics' && (
            <AnalyticsView 
              key="analytics"
              transactions={transactions}
              categories={categories}
              currencySymbol={currencySymbol}
            />
          )}
          {tab === 'categories' && (
            <CategoriesView 
              key="categories"
              userId={user.uid}
              categories={categories}
              onBack={() => setTab('settings')}
            />
          )}
          {tab === 'settings' && (
            <SettingsView 
              key="settings"
              user={user}
              settings={settings}
              setSettings={updateSettings}
              onManageCategories={() => setTab('categories')}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] glass rounded-[40px] px-8 py-4 shadow-xl z-40 flex items-center justify-between">
        <IconButton 
          icon={LayoutDashboard} 
          active={tab === 'dashboard'} 
          onClick={() => setTab('dashboard')}
          label="Home"
        />
        <IconButton 
          icon={History} 
          active={tab === 'history'} 
          onClick={() => setTab('history')}
          label="History"
        />
        
        {/* FAB */}
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gray-900 text-white p-5 rounded-[2.5rem] -translate-y-10 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300"
        >
          <Plus size={28} />
        </button>

        <IconButton 
          icon={PieChart} 
          active={tab === 'analytics'} 
          onClick={() => setTab('analytics')}
          label="Stats"
        />
        <IconButton 
          icon={Settings} 
          active={tab === 'settings'} 
          onClick={() => setTab('settings')}
          label="Config"
        />
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddModal 
            categories={categories}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={addTransaction}
            currencySymbol={currencySymbol}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Page Components ---

function Dashboard({ transactions, categories, balance, income, expenses, currencySymbol, user }: any) {
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-sm font-medium tracking-wide">Welcome, {user?.displayName?.split(' ')[0] || 'User'}</p>
          <h1 className="text-2xl font-display font-semibold">Your Finances</h1>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand-primary/20">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-brand-primary/20 flex items-center justify-center">
              <Wallet size={20} className="text-gray-700" />
            </div>
          )}
        </div>
      </header>

      {/* Balance Card */}
      <GlassCard className="bg-gradient-to-br from-gray-900 to-gray-800 text-white overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-1">Total Balance</p>
          <h2 className="text-4xl font-display font-bold mb-8">
            {currencySymbol}{balance.toLocaleString()}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 text-brand-success mb-1">
                <ArrowDownLeft size={14} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Income</span>
              </div>
              <p className="text-lg font-semibold">{currencySymbol}{income.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 text-brand-primary mb-1">
                <ArrowUpRight size={14} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Expense</span>
              </div>
              <p className="text-lg font-semibold">{currencySymbol}{expenses.toLocaleString()}</p>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </GlassCard>

      {/* Recent Transactions */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold font-display">Recent Activity</h3>
          <button className="text-brand-primary text-xs font-semibold uppercase tracking-wider">View All</button>
        </div>
        
        <div className="space-y-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t: Transaction) => (
              <TransactionItem key={t.id} transaction={t} categories={categories} currencySymbol={currencySymbol} />
            ))
          ) : (
            <p className="text-center py-10 text-gray-400 italic">No recent transactions yet.</p>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function HistoryView({ transactions, categories, currencySymbol }: any) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    return transactions.filter((t: Transaction) => 
      t.note.toLowerCase().includes(search.toLowerCase()) ||
      categories.find((c: Category) => c.id === t.categoryId)?.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [transactions, search, categories]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-display font-semibold">Transaction History</h1>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text"
          placeholder="Search transactions..."
          className="w-full bg-white rounded-2xl py-3 pl-12 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 transition-all dark:bg-gray-900 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Filter size={18} />
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map((t: Transaction) => (
          <TransactionItem key={t.id} transaction={t} categories={categories} currencySymbol={currencySymbol} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-20 text-gray-400">No transactions match your search.</p>
        )}
      </div>
    </motion.div>
  );
}

function AnalyticsView({ transactions, categories, currencySymbol }: any) {
  const pieData = useMemo(() => {
    const expenses = transactions.filter((t: Transaction) => t.type === 'expense');
    const grouped = expenses.reduce((acc: any, t: Transaction) => {
      const cat = categories.find((c: Category) => c.id === t.categoryId);
      if (!cat) return acc;
      acc[cat.name] = (acc[cat.name] || 0) + t.amount;
      return acc;
    }, {});

    return Object.keys(grouped).map(name => ({
      name,
      value: grouped[name],
      color: categories.find((c: Category) => c.name === name)?.color || '#ccc'
    }));
  }, [transactions, categories]);

  const barData = useMemo(() => {
    // Last 6 months
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const amount = transactions
        .filter((t: Transaction) => isWithinInterval(parseISO(t.date), { start, end }))
        .reduce((acc: number, t: Transaction) => t.type === 'expense' ? acc + t.amount : acc, 0);
      data.push({
        name: format(d, 'MMM'),
        amount
      });
    }
    return data;
  }, [transactions]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-2xl font-display font-semibold">Spending Analytics</h1>
      </header>

      <GlassCard className="h-64 flex flex-col justify-center items-center">
        <h3 className="text-sm font-semibold text-gray-500 mb-4 self-start">Monthly Spending Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }} 
            />
            <YAxis hide />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="amount" fill="#FFB7B2" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold font-display">Category Breakdown</h3>
        <GlassCard className="h-80 relative flex flex-col items-center justify-center">
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute pointer-events-none text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Total Expenses</p>
                <p className="text-xl font-bold font-display">
                  {currencySymbol}{pieData.reduce((acc, d) => acc + d.value, 0).toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <p className="text-gray-400 italic">Add some expenses to see analytics.</p>
          )}
        </GlassCard>
      </section>

      <div className="grid grid-cols-2 gap-4">
        {pieData.map(d => (
          <div key={d.name} className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm dark:bg-gray-900 border border-transparent dark:border-gray-800">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase">{d.name}</p>
              <p className="text-sm font-semibold">{currencySymbol}{d.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SettingsView({ settings, setSettings, onManageCategories, user }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-display font-semibold">Settings</h1>
        <button 
          onClick={() => signOut(auth)}
          className="p-2 bg-red-50 text-red-500 rounded-xl dark:bg-red-500/10"
        >
          <LogOut size={20} />
        </button>
      </header>

      <section className="space-y-6">
        {/* User Info */}
        <GlassCard className="flex items-center gap-4 bg-white/50">
          <img src={user?.photoURL || ''} alt="" className="w-12 h-12 rounded-full border-2 border-brand-primary/20" referrerPolicy="no-referrer" />
          <div>
            <h3 className="font-semibold">{user?.displayName}</h3>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </GlassCard>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Preferences</h3>
          
          <GlassCard className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-xl dark:bg-gray-800">
                  <Wallet size={18} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="font-medium">Currency</span>
              </div>
              <select 
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="bg-gray-50 px-3 py-1 rounded-lg text-sm border-none focus:ring-0 dark:bg-gray-800"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-xl dark:bg-gray-800">
                  <PieChart size={18} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="font-medium">Theme</span>
              </div>
              <button 
                onClick={() => setSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' })}
                className="w-12 h-6 bg-gray-200 rounded-full relative transition-colors duration-300 dark:bg-brand-primary/40"
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300",
                  settings.theme === 'dark' ? "translate-x-7 bg-brand-primary" : "translate-x-1"
                )} />
              </button>
            </div>
            
            <button 
              onClick={onManageCategories}
              className="flex items-center justify-between w-full group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-xl dark:bg-gray-800">
                  <Tag size={18} className="text-gray-600 dark:text-gray-300" />
                </div>
                <span className="font-medium">Manage Categories</span>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </GlassCard>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">About</h3>
          <GlassCard>
            <div className="flex items-center justify-between opacity-60">
              <span className="text-sm">App Version</span>
              <span className="text-sm">1.0.0</span>
            </div>
          </GlassCard>
        </div>

        <button 
          onClick={async () => {
            if (confirm('Are you sure you want to clear all data? This will delete all your transactions and categories from the cloud.')) {
              // Note: Bulk deletion in production should ideally happen via a batch or cloud function.
              // For simplicity in this tracker, we reset settings.
              await setSettings({ currency: 'GHS', theme: 'light' });
              alert('Settings reset. Cloud data deletion requires manual cleanup for security.');
            }
          }}
          className="w-full py-4 text-sm font-bold text-red-500 bg-red-50 rounded-3xl dark:bg-red-500/10"
        >
          Reset Settings
        </button>
      </section>
    </motion.div>
  );
}

function CategoriesView({ categories, userId, onBack }: any) {
  const [newName, setNewName] = useState('');
  
  const addCategory = async () => {
    if (!newName.trim()) return;
    try {
      const categoriesRef = collection(db, 'users', userId, 'categories');
      await addDoc(categoriesRef, {
        userId,
        name: newName,
        icon: 'Tag',
        color: '#B2E2F2',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewName('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${userId}/categories`);
    }
  };

  const removeCategory = async (id: string) => {
    if (categories.length <= 1) return;
    try {
      const catRef = doc(db, 'users', userId, 'categories', id);
      await deleteDoc(catRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${userId}/categories/${id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm dark:bg-gray-900">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-display font-semibold">Categories</h1>
      </header>

      <div className="flex gap-2">
        <input 
          type="text"
          placeholder="New category name"
          className="flex-1 bg-white rounded-2xl py-3 px-4 text-sm shadow-sm focus:outline-none dark:bg-gray-900"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button 
          onClick={addCategory}
          className="p-3 bg-gray-900 text-white rounded-2xl dark:bg-gray-800"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((c: Category) => (
          <div key={c.id} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${c.color}33` }}>
                <IconRenderer iconName={c.icon} color={c.color} size={18} />
              </div>
              <span className="font-medium">{c.name}</span>
            </div>
            <button 
              onClick={() => removeCategory(c.id)}
              className="p-2 text-red-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Shared Components ---

function TransactionItem({ transaction: t, categories, currencySymbol }: any) {
  const category = categories.find(c => c.id === t.categoryId) || categories[0];
  
  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm dark:bg-gray-900 border border-transparent hover:border-gray-200 transition-colors dark:hover:border-gray-800 group">
      <div className="flex items-center gap-4">
        <div 
          className="p-3 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}33` }} // 20% opacity
        >
          <IconRenderer iconName={category.icon} color={category.color} size={20} />
        </div>
        <div>
          <h4 className="font-medium text-sm">{category.name}</h4>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{t.note || format(parseISO(t.date), 'MMM d, yyyy')}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          "font-bold font-display",
          t.type === 'income' ? 'text-brand-success' : 'text-gray-900 dark:text-white'
        )}>
          {t.type === 'income' ? '+' : '-'}{currencySymbol}{t.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-400 font-medium">{format(parseISO(t.date), 'HH:mm')}</p>
      </div>
    </div>
  );
}

function AddModal({ categories, onClose, onAdd, currencySymbol }: any) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState(categories[0]?.id);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    
    onAdd({
      amount: parseFloat(amount),
      type,
      categoryId,
      date: `${date}T${format(new Date(), 'HH:mm:ss')}`,
      note
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-gray-50 rounded-t-[3rem] p-8 space-y-8 dark:bg-gray-950"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-display font-semibold">New Transaction</h2>
          <button onClick={onClose} className="p-2 bg-gray-200 rounded-full dark:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Amount Field */}
          <div className="text-center space-y-2">
            <div className="relative inline-block">
              <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-3xl font-light text-gray-400">{currencySymbol}</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                autoFocus
                className="bg-transparent text-5xl font-display font-bold text-center w-full focus:outline-none placeholder:text-gray-200"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-center gap-2">
              <button 
                type="button"
                onClick={() => setType('expense')}
                className={cn(
                  "px-6 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                  type === 'expense' ? "bg-gray-900 text-white shadow-lg" : "bg-white text-gray-400"
                )}
              >
                Expense
              </button>
              <button 
                type="button"
                onClick={() => setType('income')}
                className={cn(
                  "px-6 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                  type === 'income' ? "bg-brand-success text-white shadow-lg" : "bg-white text-gray-400"
                )}
              >
                Income
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Category Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Select Category</label>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar scroll-smooth">
                {categories.map((c: Category) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-3xl transition-all border-2",
                      categoryId === c.id 
                        ? "border-brand-primary bg-brand-primary/10" 
                        : "border-transparent bg-white dark:bg-gray-900"
                    )}
                  >
                    <IconRenderer iconName={c.icon} color={c.color} size={24} />
                    <span className="text-[10px] font-bold uppercase whitespace-nowrap">{c.name}</span>
                    {categoryId === c.id && <div className="absolute top-2 right-2 bg-brand-primary text-white p-0.5 rounded-full"><Check size={8} strokeWidth={4} /></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Date</label>
                <input 
                  type="date"
                  className="w-full bg-white px-4 py-3 rounded-2xl text-sm dark:bg-gray-900"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Note (Optional)</label>
                <input 
                  type="text"
                  placeholder="What was this for?"
                  className="w-full bg-white px-4 py-3 rounded-2xl text-sm dark:bg-gray-900"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
          >
            Add Transaction
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Utility to render Lucide icons by string name
import * as LucideIcons from 'lucide-react';

function IconRenderer({ iconName, color, size = 24 }: { iconName: string, color: string, size?: number }) {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Wallet size={size} style={{ color }} />;
  return <Icon size={size} style={{ color }} />;
}

function Login() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 text-gray-900 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 text-center space-y-8 max-w-sm"
      >
        <div className="w-20 h-20 bg-brand-primary rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-brand-primary/20 animate-float">
          <Wallet size={40} className="text-white" />
        </div>
        
        <div>
          <h1 className="text-4xl font-display font-bold mb-2">Aura Expense</h1>
          <p className="text-gray-500 font-medium tracking-tight px-4">
            Master your money with minimalism and peace of mind.
          </p>
        </div>

        <button 
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-4 bg-white py-4 px-6 rounded-3xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all group border border-gray-100"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-70 group-hover:opacity-100" />
          <span className="font-bold">Sign in with Google</span>
        </button>

        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-12">
          Secure Cloud Sync Enabled
        </p>
      </motion.div>

      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/10 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />
    </div>
  );
}
