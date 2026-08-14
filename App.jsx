import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, Ticket, Users, PlusCircle, Search, 
  Download, QrCode, Plane, Train, 
  Bus, Hotel, CheckCircle, XCircle, Clock, ChevronRight,
  User, Phone, Mail, MapPin, Calendar, CreditCard,
  Briefcase, Activity, AlertCircle, Menu, X, ArrowLeft,
  Sparkles, MessageCircle, Bot, ShieldCheck, Upload, Image as ImageIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const genAI = typeof __GEMINI_API_KEY__ !== 'undefined' ? new GoogleGenerativeAI(__GEMINI_API_KEY__) : null;

const generatePNR = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pnr = 'X';
  for (let i = 0; i < 9; i++) {
    pnr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pnr;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
};

const formatUTSTopDate = (dateStr, createdAt) => {
  const d = createdAt ? new Date(createdAt) : (dateStr ? new Date(dateStr) : new Date());
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
};

const formatUTSBottomDate = (dateStr, createdAt) => {
  const d = createdAt ? new Date(createdAt) : (dateStr ? new Date(dateStr) : new Date());
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const formatUTSValidTill = (dateStr, createdAt) => {
  const d = createdAt ? new Date(createdAt) : (dateStr ? new Date(dateStr) : new Date());
  const validTillDate = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const day = validTillDate.getDate().toString().padStart(2, '0');
  const month = (validTillDate.getMonth() + 1).toString().padStart(2, '0');
  const year = validTillDate.getFullYear();
  const hours = validTillDate.getHours().toString().padStart(2, '0');
  const mins = validTillDate.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  
  return (
    <div className={`fixed top-4 right-4 z-50 ${bg} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-fade-in-down`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState('');
  
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  useEffect(() => {
    if (!auth) {
        setIsLoading(false);
        return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const bookingsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'bookings');
    const unsubBookings = onSnapshot(bookingsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.createdAt - a.createdAt);
      setBookings(data);
      setIsLoading(false);
    }, (err) => console.error(err));

    const customersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'customers');
    const unsubCustomers = onSnapshot(customersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    }, (err) => console.error(err));

    return () => {
      unsubBookings();
      unsubCustomers();
    };
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleInitialBookingSubmit = (formData) => {
    let finalData = { ...formData };
    if (finalData.transportType === 'Train (General)') {
      if (!finalData.seat) finalData.seat = 'General/Unreserved';
      if (!finalData.operator) finalData.operator = 'Indian Railways';
      if (!finalData.trainType) finalData.trainType = 'ORDINARY';
      if (!finalData.distance) finalData.distance = '25';
      if (!finalData.via) finalData.via = 'LDH';
      if (!finalData.adults) finalData.adults = '1';
      if (!finalData.children) finalData.children = '0';
    }
    setPendingBookingData(finalData);
    setPaymentScreenshot(null);
    setScreenshotFileName('');
    setVerificationError('');
    setShowPaymentStep(true);
  };

  const finalizeBookingWithPayment = async (paidOnline) => {
    if (!user || !db || !pendingBookingData) return;
    
    try {
      const pnr = generatePNR();
      const bookingData = {
        ...pendingBookingData,
        pnr,
        status: 'Upcoming',
        paymentStatus: paidOnline ? 'Paid' : 'Bypassed (Secret Code 2006)',
        createdAt: Date.now(),
      };

      const bookingsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'bookings');
      await addDoc(bookingsRef, bookingData);

      const existingCustomer = customers.find(c => c.mobile === pendingBookingData.mobile);
      const customersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'customers');
      
      if (existingCustomer) {
        await updateDoc(doc(customersRef, existingCustomer.id), {
          totalBookings: (existingCustomer.totalBookings || 1) + 1,
          lastBookingDate: Date.now(),
          name: pendingBookingData.passengerName,
          email: pendingBookingData.email
        });
      } else {
        await addDoc(customersRef, {
          name: pendingBookingData.passengerName,
          mobile: pendingBookingData.mobile,
          email: pendingBookingData.email,
          totalBookings: 1,
          lastBookingDate: Date.now(),
          createdAt: Date.now()
        });
      }

      setShowPaymentStep(false);
      setPendingBookingData(null);
      setSecretCodeInput('');
      setPaymentScreenshot(null);
      setScreenshotFileName('');
      showToast(`Booking Successful! PNR: ${pnr}`);
      setActiveTab('tickets');
    } catch (err) {
      console.error(err);
      showToast('Error creating booking.', 'error');
    }
  };

  const handleSecretCodeSubmit = (e) => {
    e.preventDefault();
    if (secretCodeInput.trim() === '2006') {
      showToast('Secret code verified! Booking confirmed without online payment.');
      finalizeBookingWithPayment(false);
    } else {
      showToast('Invalid secret code. Please complete payment via UPI QR.', 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileSignature = `${file.name}_${file.size}_${file.lastModified}`;
    const isAlreadyUsed = bookings.some(b => b.screenshotSignature === fileSignature);

    if (isAlreadyUsed) {
      setVerificationError('This screenshot has already been used for a previous booking! Please upload a brand new payment screenshot.');
      setPaymentScreenshot(null);
      setScreenshotFileName('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentScreenshot({
        dataUrl: reader.result,
        signature: fileSignature
      });
      setScreenshotFileName(file.name);
      setVerificationError('');
    };
    reader.readAsDataURL(file);
  };

  const verifyPaymentAndBook = async () => {
    if (!paymentScreenshot) {
      setVerificationError('Please upload a brand new payment screenshot first.');
      return;
    }

    const isAlreadyUsed = bookings.some(b => b.screenshotSignature === paymentScreenshot.signature);
    if (isAlreadyUsed) {
      setVerificationError('This screenshot has already been used for a previous booking! Please upload a brand new payment screenshot.');
      return;
    }

    if (!genAI) {
      finalizeBookingWithPayment(true);
      return;
    }

    setIsVerifyingPayment(true);
    setVerificationError('');

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const expectedHalfFare = Number(pendingBookingData.price || 0) / 2;
      
      const base64Data = paymentScreenshot.dataUrl.split(',')[1];
      const mimeType = paymentScreenshot.dataUrl.substring(paymentScreenshot.dataUrl.indexOf(':') + 1, paymentScreenshot.dataUrl.indexOf(';'));

      const prompt = `Analyze this payment screenshot and check if it meets the following criteria:
1. The beneficiary/receiver name is "Mr LAXJIT MANOJ MANOJ GAURKHEDE" or similar variation.
2. The UPI ID is "lakshjitg@okaxis".
3. The amount paid is approximately ${expectedHalfFare} INR (half of the total ticket fare ${pendingBookingData.price} INR).

Respond ONLY in JSON format with this exact structure:
{
  "isValid": true or false,
  "reason": "explanation of why it is valid or invalid"
}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);

      const textResponse = result.response.text();
      const cleanedJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);

      if (parsed.isValid) {
        setIsVerifyingPayment(false);
        if (pendingBookingData) {
          pendingBookingData.screenshotSignature = paymentScreenshot.signature;
        }
        finalizeBookingWithPayment(true);
      } else {
        setIsVerifyingPayment(false);
        setVerificationError(`Payment verification failed: ${parsed.reason}. Please upload a genuine, fresh screenshot.`);
      }
    } catch (err) {
      console.error(err);
      setIsVerifyingPayment(false);
      finalizeBookingWithPayment(true);
    }
  };

  const askAI = async () => {
    if (!genAI || !aiPrompt) return;
    setIsAiLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are an expert travel agent assistant. Keep responses brief, professional, and directly related to travel. Query: ${aiPrompt}`;
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      setAiResponse("Failed to connect to AI. Please try again.");
    }
    setIsAiLoading(false);
  };

  const stats = useMemo(() => {
    let revenue = 0;
    let upcoming = 0;
    bookings.forEach(b => {
      if (b.status !== 'Cancelled') {
        revenue += Number(b.price || 0);
      }
      if (b.status === 'Upcoming') upcoming++;
    });
    return { revenue, totalBookings: bookings.length, upcoming, totalCustomers: customers.length };
  }, [bookings, customers]);

  const renderHome = () => (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">TravelPro Agency</h2>
        <p className="text-blue-100 opacity-90 mb-6 text-sm">Dashboard Overview</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.revenue)}</p>
          </div>
          <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Upcoming Journeys</p>
            <p className="text-2xl font-bold">{stats.upcoming}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 px-1">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Plane, label: 'Flight', color: 'bg-sky-100 text-sky-600' },
            { icon: Train, label: 'Train', color: 'bg-indigo-100 text-indigo-600' },
            { icon: Bus, label: 'Bus', color: 'bg-emerald-100 text-emerald-600' },
            { icon: Hotel, label: 'Hotel', color: 'bg-orange-100 text-orange-600' }
          ].map((item, i) => (
            <button 
              key={i} 
              onClick={() => setActiveTab('book')}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-95"
            >
              <div className={`p-3 rounded-full mb-2 ${item.color}`}>
                <item.icon size={24} />
              </div>
              <span className="text-xs font-medium text-slate-600">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-semibold text-slate-800">Recent Bookings</h3>
          <button onClick={() => setActiveTab('tickets')} className="text-blue-600 text-sm font-medium flex items-center">
            View All <ChevronRight size={16} />
          </button>
        </div>
        <div className="space-y-3">
          {bookings.slice(0, 3).map(booking => (
            <div key={booking.id} onClick={() => setSelectedTicket(booking)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-full ${booking.transportType === 'Flight' ? 'bg-sky-100 text-sky-600' : booking.transportType?.includes('Train') ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {booking.transportType === 'Flight' ? <Plane size={20} /> : booking.transportType?.includes('Train') ? <Train size={20} /> : <Bus size={20} />}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{booking.passengerName}</h4>
                  <p className="text-xs text-slate-500">{booking.from} to {booking.to}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  booking.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' :
                  booking.status === 'Completed' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {booking.status}
                </span>
                <p className="text-xs font-semibold text-slate-600 mt-1">{booking.pnr}</p>
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-500">No recent bookings found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBookTicket = () => (
    <div className="animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Book New Ticket</h2>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          handleInitialBookingSubmit(data);
        }}
        className="space-y-6"
      >
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
            <User size={16} className="mr-2" /> Passenger Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
              <input name="passengerName" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Enter passenger name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mobile *</label>
                <input name="mobile" required type="tel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Mobile number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input name="email" type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Email address" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Adults Count *</label>
                <input name="adults" required type="number" min="1" defaultValue="1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Children Count *</label>
                <input name="children" required type="number" min="0" defaultValue="0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
            <MapPin size={16} className="mr-2" /> Journey Details
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Transport Type *</label>
                <select name="transportType" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  <option value="Flight">Flight</option>
                  <option value="Train (Reserved)">Train (Reserved)</option>
                  <option value="Train (General)">Train (General) - UTS</option>
                  <option value="Bus">Bus</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Train Type (For UTS General)</label>
                <select name="trainType" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  <option value="ORDINARY">ORDINARY</option>
                  <option value="MAIL/EXPRESS">MAIL/EXPRESS</option>
                  <option value="SUPERFAST">SUPERFAST</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From *</label>
                <input name="from" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Origin" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To *</label>
                <input name="to" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Destination" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Distance (km) *</label>
                <input name="distance" required type="number" defaultValue="25" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="e.g. 25" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Via Station *</label>
                <input name="via" required type="text" defaultValue="LDH" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="e.g. LDH" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
                <input name="date" required type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Time *</label>
                <input name="time" required type="time" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
            <CreditCard size={16} className="mr-2" /> Fare & Payment
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fare Price (₹) *</label>
              <input name="price" required type="number" min="0" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="0.00" />
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex justify-center items-center">
          <CreditCard className="mr-2" size={20} /> Proceed to Payment
        </button>
      </form>
    </div>
  );

  const renderTickets = () => {
    const filteredBookings = bookings.filter(b => {
      const matchesSearch = 
        b.passengerName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        b.pnr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.mobile?.includes(searchQuery);
      const matchesFilter = filterStatus === 'All' || b.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    return (
      <div className="animate-fade-in pb-24">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">My Tickets</h2>
        
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by Name, PNR or Mobile..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 hide-scrollbar">
            {['All', 'Upcoming', 'Completed', 'Cancelled'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredBookings.length > 0 ? filteredBookings.map(booking => (
            <div 
              key={booking.id} 
              onClick={() => setSelectedTicket(booking)}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group relative"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
              
              <div className="p-4 pl-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center">
                      {booking.transportType === 'Flight' ? <Plane size={12} className="mr-1"/> : booking.transportType?.includes('Train') ? <Train size={12} className="mr-1"/> : <Bus size={12} className="mr-1"/>}
                      {booking.transportType}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      booking.status === 'Upcoming' ? 'bg-amber-100 text-amber-700' :
                      booking.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-700">PNR: {booking.pnr}</span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-1">{booking.passengerName}</h3>
                
                <div className="flex items-center text-sm text-slate-600 mb-4">
                  <span className="font-semibold">{booking.from}</span>
                  <div className="flex-1 border-t border-dashed border-slate-300 mx-2 relative">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-1">
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </div>
                  <span className="font-semibold">{booking.to}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <Ticket size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-medium text-slate-700">No tickets found</h3>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search query.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Customer Database</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {customers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {customers.map(customer => (
              <div key={customer.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-800 text-lg">{customer.name}</h3>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                    {customer.totalBookings} Bookings
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-slate-600">
                  <div className="flex items-center"><Phone size={14} className="mr-2 text-slate-400"/> {customer.mobile}</div>
                  <div className="flex items-center"><Mail size={14} className="mr-2 text-slate-400"/> {customer.email || 'N/A'}</div>
                </div>
                <div className="mt-3 text-xs text-slate-400 flex justify-between items-center">
                  <span>Last booked: {new Date(customer.lastBookingDate).toLocaleDateString()}</span>
                  <button 
                    onClick={() => {
                      showToast(`Started new booking for ${customer.name}`);
                      setActiveTab('book');
                    }}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Quick Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
             <Users size={40} className="mx-auto text-slate-300 mb-3" />
             <p className="text-slate-500">No customers saved yet.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderAiHub = () => (
    <div className="animate-fade-in pb-24 space-y-6">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Sparkles size={28} className="text-amber-300" />
          <h2 className="text-2xl font-bold">AI Travel Hub</h2>
        </div>
        <p className="text-blue-100 text-sm">Get instant travel recommendations, visa tips, and itinerary outlines.</p>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <label className="block text-sm font-bold text-slate-700">Ask Travel AI Assistant</label>
        <div className="flex space-x-2">
          <input 
            type="text" 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. 3 day itinerary for Goa, or packing list for Shimla"
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          <button 
            onClick={askAI} 
            disabled={isAiLoading || !aiPrompt}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm transition-all"
          >
            {isAiLoading ? 'Thinking...' : 'Ask'}
          </button>
        </div>

        {aiResponse && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
            <h4 className="font-bold text-blue-600 mb-2 flex items-center">
              <Bot size={18} className="mr-2"/> AI Assistant Response:
            </h4>
            {aiResponse}
          </div>
        )}
      </div>
    </div>
  );

  const PaymentModal = () => {
    if (!showPaymentStep || !pendingBookingData) return null;

    const halfFare = Number(pendingBookingData.price || 0) / 2;

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-slate-900 my-auto">
          <button 
            onClick={() => setShowPaymentStep(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-slate-900">Complete Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">Scan UPI QR to pay half fare</p>
            <div className="mt-2 inline-block bg-blue-50 text-blue-700 font-extrabold text-xl px-4 py-1.5 rounded-xl">
              {formatCurrency(halfFare)} <span className="text-xs font-normal text-slate-500">(Full: {formatCurrency(pendingBookingData.price)})</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center shadow-inner mb-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                L
              </div>
              <span className="font-bold text-slate-800 text-base">Lakshjit Gaurkhede</span>
            </div>

            <div className="relative w-48 h-48 bg-white border border-slate-200 p-2 rounded-xl shadow-sm flex items-center justify-center mb-2">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=lakshjitg@okaxis&pn=Lakshjit%20Gaurkhede&am=" 
                alt="UPI QR Code" 
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 m-auto w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-100">
                <span className="text-[10px] font-black text-amber-500">UPI</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">Scan to pay with any UPI app</p>
            
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-center w-full mb-1">
              <p className="text-[11px] font-semibold text-slate-700">Bank Of Maharashtra 2781</p>
              <p className="text-[11px] font-mono text-slate-600">UPI ID: lakshjitg@okaxis</p>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Upload NEW Payment Screenshot for Verification *</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                <div className="flex flex-col items-center justify-center pt-3 pb-3 px-2 text-center">
                  <Upload size={20} className="text-slate-400 mb-1" />
                  <p className="text-xs text-slate-500 font-medium">{screenshotFileName ? `Uploaded: ${screenshotFileName}` : 'Click to upload NEW screenshot'}</p>
                  <p className="text-[10px] text-red-500 mt-0.5">Old/reused screenshots are blocked.</p>
                </div>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {verificationError && (
              <p className="text-xs text-red-600 font-medium text-center">{verificationError}</p>
            )}
          </div>

          <button 
            onClick={verifyPaymentAndBook}
            disabled={isVerifyingPayment}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all mb-4 text-sm flex items-center justify-center"
          >
            {isVerifyingPayment ? 'Verifying Screenshot with AI...' : <><CheckCircle size={18} className="mr-2" /> Verify & Confirm Booking</>}
          </button>

          <div className="border-t border-slate-100 pt-3">
            <form onSubmit={handleSecretCodeSubmit} className="flex gap-2">
              <input 
                type="password"
                maxLength="4"
                placeholder="Secret Code" 
                value={secretCodeInput}
                onChange={(e) => setSecretCodeInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Apply
              </button>
            </form>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">Enter code 2006 to bypass payment & print full fare</p>
          </div>
        </div>
      </div>
    );
  };

  const TicketView = ({ ticket, onClose }) => {
    const [timeLeft, setTimeLeft] = useState(298);
    
    const qrImageUrl = useMemo(() => {
      if (!ticket) return "";
      const dataStr = `IRCTC_UTS_PKT:${ticket.pnr}|${ticket.passengerName}|${ticket.from}->${ticket.to}|${ticket.date}|${ticket.price}|GST:27AAAGM0289C2ZI`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(dataStr)}&format=png`;
    }, [ticket]);

    useEffect(() => {
      if (!ticket || ticket.transportType !== 'Train (General)') return;
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }, [ticket]);

    if (!ticket) return null;

    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    const isUTS = ticket.transportType === 'Train (General)';

    return (
      <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto flex flex-col animate-fade-in pb-10 select-none">
        
        {isUTS ? (
          <div className="bg-[#195bb4] shadow-md sticky top-0 z-30 px-4 py-3 flex flex-col text-white">
            <div className="flex items-center space-x-3 mb-1">
              <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-full transition-colors">
                <ArrowLeft size={24} className="text-white" />
              </button>
              <h1 className="font-semibold text-lg tracking-wide">Booking Details</h1>
            </div>
            <div className="pl-11 text-xs text-white tracking-wider font-mono">
              Mobile: {ticket.mobile}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex flex-col text-slate-800">
            <div className="flex items-center space-x-3 mb-1">
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft size={24} />
              </button>
              <h1 className="font-bold text-lg">Booking Details</h1>
            </div>
            <div className="pl-11 text-xs text-slate-500 font-mono">
              Mobile: {ticket.mobile}
            </div>
          </div>
        )}

        <div className="bg-white px-5 py-2.5 text-black font-semibold text-sm border-b border-slate-200 shadow-sm flex items-center justify-between">
          <span>Thank you {ticket.passengerName} and Happy Journey !</span>
        </div>

        <div className={`w-full max-w-md mx-auto ${isUTS ? 'pt-2 px-2' : 'pt-6 px-4'}`}>
          {isUTS ? (
            <div id="printable-ticket" className="bg-transparent flex flex-col w-full shadow-lg rounded-xl overflow-hidden mb-6">
              
              <div className="bg-[#1a1c23] text-white flex flex-col relative px-8 pt-4 pb-4 border-t-[6px] border-[#4cd964]">
                
                <div className="absolute left-2.5 top-0 bottom-0 flex items-center justify-center w-6">
                  <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                    <span className="text-[#9ca3af] text-[20px] font-black tracking-widest uppercase font-sans">INDIAN RAILWAYS</span>
                  </div>
                </div>
                <div className="absolute left-10 top-2 bottom-2 w-1" style={{ background: 'repeating-linear-gradient(to bottom, #7c8b9d 0, #7c8b9d 14px, transparent 14px, transparent 24px)' }}></div>

                <div className="absolute right-2.5 top-0 bottom-0 flex items-center justify-center w-6">
                  <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', whiteSpace: 'nowrap' }}>
                    <span className="text-[#9ca3af] text-[22px] font-black tracking-widest font-sans">भारतीय रेल</span>
                  </div>
                </div>
                <div className="absolute right-10 top-2 bottom-2 w-1" style={{ background: 'repeating-linear-gradient(to bottom, #7c8b9d 0, #7c8b9d 14px, transparent 14px, transparent 24px)' }}></div>

              <div className="text-center z-10 px-12">
                <p className="text-white text-[15px] font-bold mb-1">Dynamic preview will close in</p>
                <p className="text-[#ff3b30] text-5xl font-black mb-1 tracking-wider">{mins}:{secs}</p>
                <p className="text-[#7c8b9d] text-[11px] mb-1 font-semibold">Ticket Booking Date & Time</p>
                <p className="text-[#ff9500] text-xl font-bold mb-2">{formatUTSTopDate(ticket.date, ticket.createdAt)}</p>
                <p className="text-[#9ca3af] text-[11px] mb-0.5">{ticket.pnr}</p>
                <p className="text-[#9ca3af] text-[11px]">Ticket is Non-Transferable</p>
              </div>
            </div>

            <div className="bg-[#e9ecf1] px-5 py-4 relative z-10 overflow-hidden border-b-[6px] border-[#4cd964]">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-700 font-medium">Journey Ticket</p>
                <p className="text-slate-800 font-bold tracking-wider">{ticket.pnr}</p>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 mb-4">
                <span className="flex-1 text-left uppercase truncate pr-1">{ticket.from}</span>
                <span className="text-[#9ca3af] text-[10px] font-normal mx-1 whitespace-nowrap">--{ticket.distance || '25'} km--</span>
                <span className="flex-1 text-right uppercase truncate pl-1">{ticket.to}</span>
              </div>
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Via</p>
                  <p className="text-slate-800 font-semibold text-sm">{ticket.via || 'LDH'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs mb-0.5">Passenger</p>
                  <p className="text-slate-800 font-semibold text-sm">{ticket.adults || 1} Adult, {ticket.children || 0} Child</p>
                </div>
              </div>
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Booked on</p>
                  <p className="text-slate-800 font-semibold text-sm">{formatUTSBottomDate(ticket.date, ticket.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs mb-0.5">*Valid Till</p>
                  <p className="text-slate-800 font-semibold text-sm">{formatUTSValidTill(ticket.date, ticket.createdAt)}</p>
                </div>
              </div>
              <div className="mb-4">
                  <p className="text-slate-700 text-sm font-semibold mb-1">SECOND | {ticket.trainType || 'ORDINARY'} | JOURNEY | {formatCurrency(ticket.price)}</p>
                  <p className="text-slate-600 text-xs font-mono">IR:27AAAGM0289C2ZI</p>
                </div>
                <div className="relative h-4 flex items-center justify-center mb-3">
                  <div className="absolute left-[-28px] w-8 h-8 bg-slate-50 rounded-full z-10"></div>
                  <div className="w-full border-t border-dashed border-[#b3b9c5]"></div>
                  <div className="absolute right-[-28px] w-8 h-8 bg-slate-50 rounded-full z-10"></div>
                </div>
                <p className="text-[9px] text-slate-500 leading-tight mb-2 pr-4">
                  *Valid for start of journey within 3 hour or until departure of the first train.
                </p>
              </div>

              <div className="bg-[#fce9e9] text-[#d64e4e] text-[11px] p-3 text-center font-medium leading-relaxed px-4 shadow-sm">
                Note: This ticket is non refundable. Ticket is stored locally on the device. Please do not change your handset or perform factory reset.
              </div>

              {/* Action Buttons right above QR code */}
              <div className="bg-[#e9ecf1] py-4 px-6 flex flex-col items-center space-y-3 w-full">
                <button 
                  onClick={() => {
                    showToast('Opening connecting journey booking...');
                    setActiveTab('book');
                    onClose();
                  }}
                  className="w-full max-w-xs py-2.5 px-6 rounded-full border-2 border-blue-600 bg-white text-blue-600 font-bold text-xs shadow-md hover:bg-blue-50 transition-all text-center"
                >
                  Book Connecting Journey
                </button>
                <button 
                  onClick={() => {
                    showToast('Starting quick rebooking...');
                    setActiveTab('book');
                    onClose();
                  }}
                  className="w-full max-w-xs py-2.5 px-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md hover:bg-blue-700 transition-all text-center"
                >
                  Book Again
                </button>
              </div>

              {/* Decreased size of components inside the QR code container */}
              <div className="bg-[#e9ecf1] pb-8 flex flex-col items-center w-full">
                 <div className="w-[200px] h-[200px] bg-white p-2 shadow-sm rounded flex items-center justify-center border border-slate-200">
                    <img 
                      src={qrImageUrl} 
                      alt="Ticket High Density QR Code"
                      className="w-full h-full object-contain filter contrast-125 scale-100"
                    />
                 </div>
              </div>

              <div className="bg-[#dcdfe6] p-5 pb-8 rounded-b-xl text-slate-600">
                <p className="font-bold text-[14px] text-slate-800 mb-2">Do you know?</p>
                <p className="text-[12px] mb-3 leading-relaxed">IR recovers only 57% of cost of travel on an average.</p>
                <p className="text-[12px] leading-relaxed">This ticket is booked on a personal user ID. Its sale/purchase is an offence u/s 143 of the Railways Act, 1989.</p>
              </div>

            </div>
          ) : (
            <div id="printable-ticket" className="bg-white rounded-2xl overflow-hidden shadow-xl flex flex-col w-full mb-6 relative">
              <div className="bg-blue-600 p-5 text-white flex justify-between items-center rounded-t-2xl">
                <div className="flex items-center space-x-2">
                  <Briefcase size={24} />
                  <span className="font-bold text-xl tracking-tight">TravelPro</span>
                </div>
                <div className="text-right">
                  <p className="text-blue-100 text-xs uppercase tracking-widest font-semibold">Boarding Pass</p>
                  <p className="text-lg font-mono font-bold tracking-widest">{ticket.pnr}</p>
                </div>
              </div>
              <div className="p-6 pb-4">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-800">{ticket.from.substring(0, 3).toUpperCase()}</p>
                    <p className="text-xs text-slate-500 font-medium uppercase mt-1">{ticket.from}</p>
                  </div>
                  <div className="flex-1 px-4 flex flex-col items-center relative">
                    <div className="w-full border-t-2 border-dashed border-blue-200 absolute top-1/2 -translate-y-1/2 z-0"></div>
                    <div className="bg-white px-2 z-10 text-blue-500">
                      {ticket.transportType === 'Flight' ? <Plane size={24} /> : ticket.transportType?.includes('Train') ? <Train size={24} /> : <Bus size={24} />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 z-10 bg-white px-2 uppercase font-semibold">{ticket.operator || ticket.transportType}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-800">{ticket.to.substring(0, 3).toUpperCase()}</p>
                    <p className="text-xs text-slate-500 font-medium uppercase mt-1">{ticket.to}</p>
                  </div>
                </div>
              </div>
              <div className="relative h-4 flex items-center justify-center">
                <div className="absolute left-[-12px] w-6 h-6 bg-slate-50 rounded-full z-10"></div>
                <div className="w-full border-t-2 border-dashed border-slate-200"></div>
                <div className="absolute right-[-12px] w-6 h-6 bg-slate-50 rounded-full z-10"></div>
              </div>
              <div className="p-6 pt-4 bg-slate-50">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Passenger</p>
                    <p className="font-semibold text-slate-800">{ticket.passengerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Date</p>
                    <p className="font-semibold text-slate-800">{new Date(ticket.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Time</p>
                    <p className="font-semibold text-slate-800">{ticket.time}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Seat</p>
                    <p className="font-semibold text-slate-800">{ticket.seat || 'Unassigned'}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-white rounded-b-2xl">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Fare</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(ticket.price)}</p>
                </div>
                <div className="bg-white py-4 flex flex-col items-center">
                   <div className="w-32 h-32 bg-white p-1 shadow-sm flex items-center justify-center border border-slate-100 rounded">
                      <img 
                        src={qrImageUrl} 
                        alt="High Density QR Code"
                        className="w-full h-full object-contain filter contrast-125"
                      />
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-blue-600 select-none">
        <Activity size={48} className="animate-pulse mb-4" />
        <h1 className="text-xl font-bold tracking-wider">Loading TravelPro...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200 relative select-none">
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2 text-blue-600">
          <Briefcase size={22} className="stroke-[2.5]" />
          <h1 className="font-bold text-lg tracking-tight">TravelPro</h1>
        </div>
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold shadow-inner">
          <User size={16} />
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto w-full">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'book' && renderBookTicket()}
        {activeTab === 'tickets' && renderTickets()}
        {activeTab === 'customers' && renderCustomers()}
        {activeTab === 'ai' && renderAiHub()}
      </main>

      {selectedTicket && <TicketView ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      <PaymentModal />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-40">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'book', icon: PlusCircle, label: 'Book' },
            { id: 'tickets', icon: Ticket, label: 'Tickets' },
            { id: 'customers', icon: Users, label: 'Customers' },
            { id: 'ai', icon: Sparkles, label: 'AI Hub' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`mb-1 transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
                <tab.icon size={22} className={activeTab === tab.id ? 'stroke-[2.5]' : ''} />
              </div>
              <span className={`text-[10px] font-semibold ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Prevent zooming on mobile and desktop viewports */
        html, body {
          touch-action: manipulation;
          -webkit-text-size-adjust: 100%;
          user-select: none;
          max-width: 100%;
          overflow-x: hidden;
        }
        @media print {
          body * { visibility: hidden; }
          #printable-ticket, #printable-ticket * { visibility: visible; }
          #printable-ticket { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }
      `}} />
    </div>
  );
}
