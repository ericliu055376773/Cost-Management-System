// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Lock, ChevronLeft, Package, RefreshCw, Calculator, DollarSign, Beef, Carrot, Fish, Coffee, CheckCircle, AlertCircle, Utensils, Plus, Trash2, Edit2, Layers, ChevronRight, Store, Settings, Save, Scale, Receipt, FolderPlus, Tag, Filter, Type } from 'lucide-react';

// ==========================================
// Firebase 雲端資料庫設定
// ==========================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';

// 兼容 Canvas 環境與原廠設定
const fallbackConfig = {
  apiKey: "AIzaSyAc0LGsLeEBcJ3fOj08NwAWbZL0d3GKHrA",
  authDomain: "ypxerp.firebaseapp.com",
  projectId: "ypxerp",
  storageBucket: "ypxerp.firebasestorage.app",
  messagingSenderId: "684981995411",
  appId: "1:684981995411:web:a32310ced01fc8ca964a66",
  measurementId: "G-MFJ8WW5707"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : fallbackConfig;
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const erpAppId = typeof __app_id !== 'undefined' ? __app_id : 'hotpot-erp-system';

// 預設分類判斷邏輯 (新增蛤仔判斷)
const inferCategory = (itemName) => {
  if (/牛|豬|雞|羊|肉|鴨|鵝/.test(itemName)) return '肉類';
  if (/蝦|魚|蟹|干貝|透抽|蛤|蚵|海鮮|花枝|魷/.test(itemName)) return '海鮮類';
  if (/菜|蔥|蒜|菇|瓜|蘿蔔|洋蔥|番茄|筍|芋|蓮/.test(itemName)) return '蔬菜類';
  if (/餃|丸|豆腐|豆皮|血|漿|麵|冬粉|飯/.test(itemName)) return '火鍋料與副餐';
  return '飲品與其他';
};

// 極簡金融風格：單色輪廓圖示與極簡底色
const getIconByCategory = (categoryName) => {
  if (!categoryName) return <Coffee className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('肉')) return <Beef className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('菜') || categoryName.includes('蔬')) return <Carrot className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('海') || categoryName.includes('魚') || categoryName.includes('蝦')) return <Fish className="w-6 h-6 text-black" strokeWidth={1.5} />;
  return <Coffee className="w-6 h-6 text-black" strokeWidth={1.5} />;
};

const getColorByCategory = () => {
  return 'bg-[#F9F9F9] border-neutral-200 text-black';
};

// 初始原始資料
const initialRawData = [
  { category: '肉類', vendor: '美福頂級肉品', name: '無骨雞腿肉', rawPrice: 120, unit: 'kg' },
  { category: '肉類', vendor: '美福頂級肉品', name: '特級牛五花', rawPrice: 350, unit: 'kg' },
  { category: '蔬菜類', vendor: '產地直送', name: '高山高麗菜', rawPrice: 45, unit: 'kg' },
  { category: '火鍋料與副餐', vendor: '知名大廠', name: '手工蛋餃', rawPrice: 150, unit: '包' },
  { category: '海鮮類', vendor: '極鮮海產批發', name: '冷凍白蝦 (40/50)', rawPrice: 280, unit: 'kg' },
];

const defaultRules = {
  '無骨雞腿肉': { yieldRate: 85, calculationText: '進貨價 ÷ 淨肉率 (85%)', recipeUnit: 'g', recipeConversion: 1000 },
  '特級牛五花': { yieldRate: 90, calculationText: '進貨價 ÷ 淨肉率 (90%)', recipeUnit: 'g', recipeConversion: 1000 },
  '高山高麗菜': { yieldRate: 70, calculationText: '去外葉耗損 (70%)', recipeUnit: 'g', recipeConversion: 1000 },
  '手工蛋餃': { yieldRate: 100, calculationText: '無耗損 (一包約30個)', recipeUnit: '個', recipeConversion: 30 },
  '冷凍白蝦 (40/50)': { yieldRate: 50, calculationText: '進貨價 ÷ 剝殼去頭淨肉率 (50%)', recipeUnit: 'g', recipeConversion: 1000 }
};

// 預設系統介面文字 (供客製化)
const defaultUITexts = {
  loginTitle: 'Reset password',
  loginErrorNotLongEnough: 'Password not long enough',
  loginButton: 'Reset',
  loginCancel: 'Cancel',
  sidebarMenu: '主選單',
  tabIngredients: '食材成本',
  tabSetMenus: '商品計算',
  tabSettings: '系統參數',
  statusTitle: '系統狀態',
  statusText: '雲端已連線'
};

const defaultGlobalSettings = { taxRate: 5, systemName: 'FINERP', uiTexts: defaultUITexts };

const initialSetMenus = [
  {
    id: 'sm1', name: '綜合大菜盤', sellingPrice: 180,
    categories: [
      {
        id: 'cat-1',
        name: '生鮮蔬菜',
        items: [
          { id: 'ig1', itemId: 'item-產地直送-高山高麗菜', itemName: '高山高麗菜', vendorName: '產地直送', qty: 150, unit: 'g' }
        ]
      },
      {
        id: 'cat-2',
        name: '精選火鍋料',
        items: [
          { id: 'ig2', itemId: 'item-知名大廠-手工蛋餃', itemName: '手工蛋餃', vendorName: '知名大廠', qty: 2, unit: '個' }
        ]
      }
    ]
  }
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const [isShaking, setIsShaking] = useState(false); 
  
  const [currentTab, setCurrentTab] = useState('ingredients'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); 
  const [selectedVendor, setSelectedVendor] = useState(null);     
  
  const [editingMenu, setEditingMenu] = useState(null); 
  const [ingredientCategoryFilters, setIngredientCategoryFilters] = useState({}); 
  
  const [settingsCategoryFilter, setSettingsCategoryFilter] = useState('全部');
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  
  const [rawErpData, setRawErpData] = useState(initialRawData); 
  const [productRules, setProductRules] = useState(defaultRules); 
  const [globalSettings, setGlobalSettings] = useState(defaultGlobalSettings);
  
  const [editingRules, setEditingRules] = useState({}); 
  const [editingGlobalSettings, setEditingGlobalSettings] = useState(defaultGlobalSettings);
  const [setMenus, setSetMenus] = useState(initialSetMenus);

  const [isEditingUI, setIsEditingUI] = useState(false);
  const [tempUITexts, setTempUITexts] = useState(defaultUITexts);
  const [tempSystemName, setTempSystemName] = useState(defaultGlobalSettings.systemName);

  const texts = globalSettings.uiTexts || defaultUITexts;

  // ==========================================
  // 【資料動態計算器】
  // ==========================================
  const erpData = useMemo(() => {
    const grouped = {};
    rawErpData.forEach(item => {
       if (!grouped[item.category]) grouped[item.category] = {};
       if (!grouped[item.category][item.vendor]) grouped[item.category][item.vendor] = [];
       
       const rule = productRules[item.name] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: item.unit, recipeConversion: 1 };
       const finalCost = item.rawPrice / (rule.yieldRate / 100);
       const rUnit = rule.recipeUnit || item.unit;
       const rConv = rule.recipeConversion || 1;
       const recipeCost = finalCost / rConv;
       
       grouped[item.category][item.vendor].push({
          id: `item-${item.vendor}-${item.name}`,
          name: item.name,
          rawPrice: item.rawPrice,
          unit: item.unit,
          yieldRate: `${rule.yieldRate}%`,
          calculation: rule.calculationText,
          finalCost: finalCost,
          recipeUnit: rUnit,
          recipeConversion: rConv,
          recipeCost: recipeCost
       });
    });

    return Object.keys(grouped).map((catName, index) => ({
       id: `cat-${index}`,
       category: catName,
       icon: getIconByCategory(catName),
       color: getColorByCategory(catName),
       vendors: Object.keys(grouped[catName]).map(vName => ({
          vendorName: vName,
          items: grouped[catName][vName]
       }))
    }));
  }, [rawErpData, productRules]);

  const allAvailableIngredients = useMemo(() => {
    return erpData.flatMap(cat => cat.vendors.flatMap(v => v.items.map(item => ({ ...item, categoryName: cat.category, vendorName: v.vendorName }))));
  }, [erpData]);

  const uniqueProductsForSettings = useMemo(() => {
    const map = new Map();
    rawErpData.forEach(item => {
      if (!map.has(item.name)) {
        map.set(item.name, item);
      }
    });
    return Array.from(map.values());
  }, [rawErpData]);

  const availableCategories = useMemo(() => {
    const cats = new Set(uniqueProductsForSettings.map(item => item.category));
    return ['全部', ...Array.from(cats)];
  }, [uniqueProductsForSettings]);

  const filteredSettingsProducts = useMemo(() => {
    return uniqueProductsForSettings.filter(item => {
      const matchCat = settingsCategoryFilter === '全部' || item.category === settingsCategoryFilter;
      const matchSearch = item.name.toLowerCase().includes(settingsSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [uniqueProductsForSettings, settingsCategoryFilter, settingsSearchQuery]);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (pin === '1021' || pin === '0204') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
      setPin('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500); 
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      setTimeout(() => handleLogin(), 150); 
    }
  }, [pin]);

  // Firebase Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
         console.error('Firebase Auth Error:', err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  // Firebase Data Fetching
  useEffect(() => {
    if (!firebaseUser) return;
    
    const rulesRef = doc(db, 'artifacts', erpAppId, 'public', 'data', 'hotpot_cost_rules', 'rules');
    const unsubscribe = onSnapshot(rulesRef, (docSnap) => {
      if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.rules) setProductRules(prev => ({ ...prev, ...data.rules }));
          if (data.globalSettings) setGlobalSettings(prev => ({ ...prev, ...data.globalSettings }));
      }
    }, (error) => {
      console.error("Error listening to rules:", error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (currentTab === 'settings') {
      setEditingRules(productRules);
      setEditingGlobalSettings(globalSettings);
    }
  }, [currentTab, productRules, globalSettings]);

  // ==========================================
  // ⚡ 強化版同步函式 (完全透明進度與錯誤)
  // ==========================================
  const handleSync = async (isAuto = false) => {
    if (!firebaseUser) return;
    
    setIsSyncing(true);
    setSyncMessage(null); 
    try {
      const ordersRef = collection(db, 'artifacts', erpAppId, 'public', 'data', 'hotpot_orders');
      const querySnapshot = await getDocs(ordersRef);
      const ordersList = querySnapshot.docs.map(doc => doc.data()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const finalProductsMap = new Map();
      
      let totalItemsImported = 0;

      ordersList.forEach(order => {
         const vendorName = order.id.split('-')[1] || '未分類廠商';
         if (Array.isArray(order.items)) {
           order.items.forEach(item => {
              if (item.name) {
                totalItemsImported++;
                // 【修改這裡】優先使用點貨系統傳過來的分類 (item.category)，若無則 fallback 到原本的字串判斷
                const cat = item.category || inferCategory(item.name);
                const key = `${vendorName}-${item.name}`; 
                finalProductsMap.set(key, {
                   category: cat, vendor: vendorName, name: item.name,
                   rawPrice: parseFloat(item.price) || 0, unit: item.unit || '件'
                });
              }
           });
         }
      });

      const newRawData = Array.from(finalProductsMap.values());
      
      // 關鍵修改：不論有沒有抓到資料，都強制蓋掉預設的假資料 (雞腿肉那些)
      // 這樣如果連線成功但抓到 0 筆資料，畫面也會變空，不會讓使用者誤以為沒同步
      setRawErpData(newRawData); 

      if (newRawData.length > 0) {
        setSyncMessage({ type: 'success', text: `✅ 同步成功！讀取 ${ordersList.length} 張單據，匯入 ${newRawData.length} 項食材。` });
      } else {
        setSyncMessage({ type: 'error', text: `⚠️ 連線成功，但資料庫內目前沒有任何食材名稱。(找到 ${ordersList.length} 張空單據)` });
      }
    } catch (err) {
      console.error('Firebase 同步錯誤:', err);
      // 如果被權限擋住，會在這裡清楚顯示
      setSyncMessage({ type: 'error', text: `❌ 同步被拒絕: ${err.message} (請確認 Firebase 白名單設定)` });
    } finally {
      setIsSyncing(false);
      // 把訊息停留時間拉長到 8 秒，讓使用者能看清楚
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      handleSync(true); // 登入後自動執行背景同步
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, firebaseUser]);

  const saveSettingsToCloud = async () => {
    if (!firebaseUser) return;
    setIsSyncing(true);
    try {
       const rulesRef = doc(db, 'artifacts', erpAppId, 'public', 'data', 'hotpot_cost_rules', 'rules');
       await setDoc(rulesRef, { rules: editingRules, globalSettings: editingGlobalSettings }, { merge: true });
       setSyncMessage({ type: 'success', text: '參數儲存成功！' });
       setCurrentTab('ingredients'); 
    } catch(e) {
       console.error(e);
       setSyncMessage({ type: 'error', text: '儲存失敗，請檢查網路連線。' });
    } finally {
       setIsSyncing(false);
       setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const openUIEditor = () => {
    setTempUITexts(globalSettings.uiTexts || defaultUITexts);
    setTempSystemName(globalSettings.systemName || 'FINERP');
    setIsEditingUI(true);
  };

  const saveUITexts = async () => {
    if (!firebaseUser) return;
    const newSettings = { ...globalSettings, uiTexts: tempUITexts, systemName: tempSystemName };
    try {
       const rulesRef = doc(db, 'artifacts', erpAppId, 'public', 'data', 'hotpot_cost_rules', 'rules');
       await setDoc(rulesRef, { globalSettings: newSettings }, { merge: true });
       setGlobalSettings(newSettings); 
       setIsEditingUI(false);
    } catch(e) {
       console.error("UI Text Save Error:", e);
       alert("儲存失敗");
    }
  };

  const handleRuleChange = (productName, field, value) => {
    setEditingRules(prev => {
       const existingRule = prev[productName] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: '', recipeConversion: 1 };
       return { ...prev, [productName]: { ...existingRule, [field]: value } };
    });
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return allAvailableIngredients.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allAvailableIngredients]);

  const renderUIEditor = () => {
    if (!isEditingUI) return null;
    
    const renderInputField = (label, valueKey) => (
      <div key={valueKey}>
        <label className="block text-xs font-bold text-[#7F7F7F] mb-2 tracking-widest uppercase">{label}</label>
        <input 
          type="text" value={tempUITexts[valueKey] || ''}
          onChange={(e) => setTempUITexts({...tempUITexts, [valueKey]: e.target.value})}
          className="w-full bg-[#F5F5F5] border-transparent rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all"
        />
      </div>
    );

    return (
      <div className="fixed inset-0 z-[100] bg-[#F5F5F5] flex flex-col animate-in fade-in duration-300 overflow-y-auto selection:bg-neutral-200">
        <div className="bg-white border-b border-neutral-100 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsEditingUI(false)} className="w-10 h-10 flex items-center justify-center bg-[#F5F5F5] rounded-full text-black hover:bg-neutral-200 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-xl font-black text-black tracking-tight">自訂系統文字</h2>
          </div>
          <button onClick={saveUITexts} className="bg-black hover:bg-neutral-800 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-[0_10px_20px_rgba(0,0,0,0.08)] transition-all">
            儲存變更
          </button>
        </div>

        <div className="max-w-3xl mx-auto w-full p-6 py-8 space-y-8">
          <section className="bg-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100">
             <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
               <div className="p-2 bg-[#F5F5F5] rounded-full"><Lock size={18} className="text-black"/></div>
               登入畫面文字
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {renderInputField("大標題", "loginTitle")}
               {renderInputField("長度不足錯誤文字", "loginErrorNotLongEnough")}
               {renderInputField("登入按鈕文字", "loginButton")}
               {renderInputField("底部取消按鈕", "loginCancel")}
             </div>
          </section>
          
          <section className="bg-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100">
             <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
               <div className="p-2 bg-[#F5F5F5] rounded-full"><Type size={18} className="text-black"/></div>
               導覽列與介面文字
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className="block text-xs font-bold text-[#7F7F7F] mb-2 tracking-widest uppercase">系統名稱 (LOGO)</label>
                 <input 
                   type="text" value={tempSystemName}
                   onChange={(e) => setTempSystemName(e.target.value)}
                   className="w-full bg-[#F5F5F5] border-transparent rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all"
                 />
               </div>
               {renderInputField("側邊欄群組標題", "sidebarMenu")}
               {renderInputField("分頁 1 名稱", "tabIngredients")}
               {renderInputField("分頁 2 名稱", "tabSetMenus")}
               {renderInputField("分頁 3 名稱", "tabSettings")}
               {renderInputField("狀態欄標題", "statusTitle")}
               {renderInputField("狀態欄提示字", "statusText")}
             </div>
          </section>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans selection:bg-neutral-200 relative overflow-hidden">
        <style>
          {`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-6px); }
              40%, 80% { transform: translateX(6px); }
            }
            .animate-shake {
              animation: shake 0.4s ease-in-out;
            }
          `}
        </style>
        <div className={`w-full max-w-[320px] flex flex-col items-center z-10 ${isShaking ? 'animate-shake' : ''}`}>
          <div className="w-16 h-16 bg-[#F5F5F5] rounded-[20px] flex items-center justify-center mb-8 border border-neutral-100 shadow-sm">
            <Lock className="w-8 h-8 text-black" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold text-black tracking-wide mb-12">{texts.loginTitle}</h1>
          <div className="w-full">
            <form onSubmit={handleLogin} className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-6 mb-8 relative w-full h-[30px]">
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ease-out ${
                        isFilled ? 'bg-black scale-125 shadow-[0_4px_10px_rgba(0,0,0,0.15)]' : 'bg-[#E5E5E5]'
                      }`}
                    />
                  );
                })}
                <input
                  type="tel"
                  maxLength="4"
                  value={pin}
                  onChange={(e) => {
                    setError(''); 
                    setPin(e.target.value.replace(/\D/g, ''));
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-none z-10"
                  autoFocus
                />
              </div>
              <div className="h-6 mb-8 flex items-center justify-center w-full">
                {(pin.length < 4 || error) && (
                   <p className="text-[#E04D41] text-xs font-bold tracking-wide">{error || texts.loginErrorNotLongEnough}</p>
                )}
              </div>
              <button
                type="submit" disabled={pin.length !== 4}
                className="w-full bg-black text-white hover:bg-neutral-800 disabled:bg-[#F5F5F5] disabled:text-neutral-400 disabled:cursor-not-allowed font-bold py-4 rounded-[20px] transition-all text-sm tracking-wide shadow-[0_10px_20px_rgba(0,0,0,0.08)] disabled:shadow-none"
              >
                {texts.loginButton}
              </button>
              <button
               type="button"
               onClick={() => setPin('')}
               className="w-full text-center mt-6 text-[#7F7F7F] hover:text-black font-bold text-sm tracking-wide transition-colors"
              >
                {texts.loginCancel}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderSettingsTab = () => {
    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabSettings}</h2>
            <p className="text-[#7F7F7F] font-medium text-sm mt-2 tracking-wide">設定全域稅率、顯示名稱與各項食材規則。</p>
          </div>
          <button 
            onClick={saveSettingsToCloud} disabled={isSyncing}
            className="w-full sm:w-auto bg-black hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:bg-neutral-200 disabled:text-neutral-400 shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
          >
            <Save size={18} /> {isSyncing ? '儲存中...' : '儲存變更'}
          </button>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 mb-8">
           <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
             <div className="p-2 bg-[#F5F5F5] rounded-full"><Receipt size={20} className="text-black"/></div>
             全域系統設定
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div>
                 <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase">系統顯示名稱 (LOGO)</label>
                 <div className="relative">
                   <input 
                     type="text"
                     value={editingGlobalSettings.systemName || ''}
                     onChange={(e) => setEditingGlobalSettings({...editingGlobalSettings, systemName: e.target.value})}
                     className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black transition-all text-lg"
                     placeholder="例如: FINERP"
                   />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase">營業稅率 (%)</label>
                 <div className="relative">
                   <input 
                     type="number" min="0" max="100" step="0.1"
                     value={editingGlobalSettings.taxRate}
                     onChange={(e) => setEditingGlobalSettings({...editingGlobalSettings, taxRate: parseFloat(e.target.value) || 0})}
                     className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black transition-all text-lg"
                   />
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 mb-8 flex flex-col gap-5">
           <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#7F7F7F]" />
              </div>
              <input
                type="text" value={settingsSearchQuery} onChange={(e) => setSettingsSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-5 py-4 border-transparent rounded-[24px] bg-[#F5F5F5] text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black transition-all font-medium"
                placeholder="搜尋要設定的項目..."
              />
           </div>
           <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => (
                 <button
                   key={cat} onClick={() => setSettingsCategoryFilter(cat)}
                   className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${settingsCategoryFilter === cat ? 'bg-black text-white' : 'bg-[#F5F5F5] text-[#7F7F7F] hover:bg-neutral-200 hover:text-black'}`}
                 >
                   {cat}
                 </button>
              ))}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSettingsProducts.map((item, idx) => {
            const rule = editingRules[item.name] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: item.unit, recipeConversion: 1 };
            const previewCost = item.rawPrice / (rule.yieldRate / 100);
            const rUnit = rule.recipeUnit || item.unit;
            const rConv = rule.recipeConversion || 1;
            const previewRecipeCost = previewCost / rConv;

            return (
              <div key={idx} className="bg-white rounded-[32px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-bold text-[#7F7F7F] uppercase tracking-widest block mb-2">{item.category}</span>
                    <h3 className="text-2xl font-black text-black leading-tight tracking-tight">{item.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#7F7F7F] font-bold tracking-widest uppercase block mb-1">進貨參考價</span>
                    <span className="font-black text-black text-lg">${item.rawPrice} <span className="text-xs text-[#7F7F7F] font-medium">/{item.unit}</span></span>
                  </div>
                </div>

                <div className="space-y-6 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase">淨肉率 / 良率 (%)</label>
                    <input 
                      type="number" min="1" max="100" value={rule.yieldRate}
                      onChange={(e) => handleRuleChange(item.name, 'yieldRate', parseFloat(e.target.value) || 100)}
                      className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase">配方計算單位</label>
                       <input 
                         type="text" value={rule.recipeUnit || item.unit}
                         onChange={(e) => handleRuleChange(item.name, 'recipeUnit', e.target.value)}
                         className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-bold"
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase truncate" title={`1 ${item.unit} = ? ${rule.recipeUnit || item.unit}`}>單位轉換</label>
                       <input 
                         type="number" min="0.01" step="0.01" value={rule.recipeConversion || 1}
                         onChange={(e) => handleRuleChange(item.name, 'recipeConversion', parseFloat(e.target.value) || 1)}
                         className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-bold"
                       />
                     </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#7F7F7F] mb-3 tracking-widest uppercase">成本算法說明</label>
                    <input 
                      type="text" value={rule.calculationText}
                      onChange={(e) => handleRuleChange(item.name, 'calculationText', e.target.value)}
                      className="w-full bg-[#F5F5F5] border-transparent rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-medium"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-neutral-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#7F7F7F] tracking-widest uppercase flex items-center gap-2">
                    <div className="p-1.5 bg-neutral-100 rounded-full"><Scale size={14} className="text-black"/></div>
                    配方單位成本
                  </span>
                  <span className="font-black text-black text-2xl flex items-center">
                    <DollarSign size={20} className="-mt-0.5 opacity-40" />
                    {previewRecipeCost < 1 ? previewRecipeCost.toFixed(4) : previewRecipeCost.toFixed(2)} 
                    <span className="text-sm opacity-50 font-medium ml-1">/{rUnit}</span>
                  </span>
                </div>
              </div>
            );
          })}
          {filteredSettingsProducts.length === 0 && (
             <div className="col-span-full text-center py-24 text-[#7F7F7F] font-medium rounded-[32px] bg-[#F5F5F5]">
                找不到相符的項目。
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderSetMenuTab = () => {
    if (editingMenu) {
      let totalIngredientsCost = 0;
      
      const updatedCategories = (editingMenu.categories || []).map(cat => {
        const updatedItems = (cat.items || []).map(ig => {
           const latestInfo = allAvailableIngredients.find(a => a.name === ig.itemName && a.vendorName === ig.vendorName) || ig;
           const rCost = latestInfo.recipeCost || latestInfo.finalCost;
           const rUnit = latestInfo.recipeUnit || latestInfo.unit;
           totalIngredientsCost += rCost * ig.qty;
           return { ...ig, recipeCost: rCost, recipeUnit: rUnit, finalCost: latestInfo.finalCost };
        });
        return { ...cat, items: updatedItems };
      });

      const taxAmount = (editingMenu.sellingPrice || 0) * (globalSettings.taxRate / 100);
      const totalCost = totalIngredientsCost + taxAmount;
      const margin = editingMenu.sellingPrice > 0 ? (((editingMenu.sellingPrice - totalCost) / editingMenu.sellingPrice) * 100).toFixed(1) : 0;

      const handleAddCategory = () => setEditingMenu({...editingMenu, categories: [...updatedCategories, { id: `cat-${Date.now()}`, name: '未命名分類', items: [] }]});
      const handleUpdateCategoryName = (catId, newName) => setEditingMenu({...editingMenu, categories: updatedCategories.map(c => c.id === catId ? { ...c, name: newName } : c)});
      const handleRemoveCategory = (catId) => setEditingMenu({...editingMenu, categories: updatedCategories.filter(c => c.id !== catId)});
      const handleAddIngredientToCategory = (catId, selectedId) => {
         if (!selectedId) return;
         const ing = allAvailableIngredients.find(i => i.id === selectedId);
         if (ing) setEditingMenu({...editingMenu, categories: updatedCategories.map(c => c.id === catId ? { ...c, items: [...c.items, { id: `ig-${Date.now()}`, itemId: ing.id, itemName: ing.name, vendorName: ing.vendorName, recipeCost: ing.recipeCost, qty: 1, recipeUnit: ing.recipeUnit }] } : c)});
      };
      const handleUpdateIngredientQty = (catId, igId, newQty) => setEditingMenu({...editingMenu, categories: updatedCategories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === igId ? { ...i, qty: newQty } : i) } : c)});
      const handleRemoveIngredient = (catId, igId) => setEditingMenu({...editingMenu, categories: updatedCategories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== igId) } : c)});
      const handleSaveMenu = () => {
        const menuToSave = { ...editingMenu, categories: updatedCategories };
        if (setMenus.find(m => m.id === editingMenu.id)) setSetMenus(setMenus.map(m => m.id === editingMenu.id ? menuToSave : m));
        else setSetMenus([...setMenus, menuToSave]);
        setEditingMenu(null);
      };

      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-24 md:pb-8">
          <button onClick={() => setEditingMenu(null)} className="flex items-center text-[#7F7F7F] hover:text-black font-bold mb-8 transition-all w-fit">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center mr-3 border border-neutral-100"><ChevronLeft className="w-4 h-4" /></div>
            返回商品列表
          </button>
          
          <div className="bg-white rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 overflow-hidden mb-8 flex flex-col">
            <div className="bg-black p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 w-full">
                 <span className="text-[#7F7F7F] text-xs font-bold uppercase tracking-widest mb-2 block">商品名稱</span>
                 <input 
                   type="text" value={editingMenu.name} onChange={e => setEditingMenu({...editingMenu, name: e.target.value})} 
                   className="bg-transparent text-white border-b border-neutral-800 hover:border-neutral-600 focus:border-white px-0 py-2 font-black text-3xl w-full outline-none transition-colors placeholder-neutral-700 tracking-tight"
                   placeholder="輸入商品名稱..."
                 />
              </div>
              <div className="bg-neutral-900 p-5 rounded-[24px] border border-neutral-800 flex items-center gap-4 shrink-0">
                <span className="text-[#7F7F7F] font-bold text-xs uppercase tracking-widest">終端售價</span>
                <div className="flex items-center text-white">
                  <DollarSign className="w-6 h-6 opacity-50" />
                  <input 
                    type="number" value={editingMenu.sellingPrice} onChange={e => setEditingMenu({...editingMenu, sellingPrice: parseFloat(e.target.value)||0})} 
                    className="bg-transparent text-white font-black text-4xl w-32 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-white flex-1">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="font-black text-black text-2xl tracking-tight">配方結構建構器</h3>
                </div>
                <button onClick={handleAddCategory} className="flex items-center gap-2 bg-[#F5F5F5] hover:bg-neutral-200 text-black px-5 py-3 rounded-full font-bold text-sm transition-all whitespace-nowrap">
                   <FolderPlus size={16} /> 新增分類
                </button>
              </div>

              <div className="space-y-8">
                {updatedCategories.map((cat) => {
                  const catSubtotal = (cat.items || []).reduce((sum, ig) => sum + ((ig.recipeCost || 0) * ig.qty), 0);
                  return (
                  <div key={cat.id} className="bg-[#F5F5F5] rounded-[24px] p-6">
                     <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                           <input 
                             type="text" value={cat.name} onChange={(e) => handleUpdateCategoryName(cat.id, e.target.value)}
                             className="bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black outline-none font-black text-xl text-black px-1 py-1 w-full sm:max-w-[250px] transition-colors"
                             placeholder="分類名稱..."
                           />
                           <div className="ml-3 px-3 py-1.5 bg-white rounded-full text-xs font-bold text-[#7F7F7F] flex items-center gap-2 shadow-sm">
                             小計 <span className="text-black font-black text-sm">${catSubtotal.toFixed(1)}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 xl:justify-end">
                           <div className="flex items-center bg-white p-1.5 rounded-full shadow-sm">
                              <select 
                                value={ingredientCategoryFilters[cat.id] || ''} onChange={(e) => setIngredientCategoryFilters({...ingredientCategoryFilters, [cat.id]: e.target.value})}
                                className="bg-transparent text-[#7F7F7F] font-bold px-3 py-2 outline-none cursor-pointer text-sm border-r border-neutral-100"
                              >
                                <option value="">全部分類</option>
                                {availableCategories.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select 
                                onChange={(e) => { handleAddIngredientToCategory(cat.id, e.target.value); e.target.value=''; }} defaultValue="" 
                                className="bg-transparent text-black font-black px-3 py-2 outline-none cursor-pointer text-sm w-full sm:w-[180px] truncate"
                              >
                                <option value="" disabled>+ 新增單品...</option>
                                {allAvailableIngredients.filter(ing => ingredientCategoryFilters[cat.id] ? ing.categoryName === ingredientCategoryFilters[cat.id] : true).map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name}</option>
                                ))}
                              </select>
                           </div>
                           <button onClick={() => handleRemoveCategory(cat.id)} className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-black bg-white rounded-full shadow-sm transition-colors">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>

                     <div className="space-y-3">
                        {cat.items.map((ig) => (
                           <div key={ig.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-[16px] gap-4 shadow-sm border border-transparent hover:border-neutral-200 transition-colors">
                             <div className="flex-1 flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                                 <Tag size={14} className="text-black"/>
                               </div>
                               <div>
                                 <h4 className="font-black text-black text-base leading-none mb-1.5">{ig.itemName}</h4>
                                 <p className="text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest">{ig.vendorName} • ${(ig.recipeCost || 0) < 1 ? (ig.recipeCost || 0).toFixed(4) : (ig.recipeCost || 0).toFixed(2)}/{ig.recipeUnit}</p>
                               </div>
                             </div>
                             
                             <div className="flex items-center gap-6 sm:justify-end">
                               <div className="flex items-center bg-[#F5F5F5] rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-black">
                                 <input 
                                   type="number" step="0.01" min="0" value={ig.qty} onChange={e => handleUpdateIngredientQty(cat.id, ig.id, parseFloat(e.target.value) || 0)}
                                   className="w-16 px-3 py-2.5 text-center font-black text-black bg-transparent outline-none text-sm"
                                 />
                                 <span className="pr-4 text-[#7F7F7F] font-bold text-xs">{ig.recipeUnit}</span>
                               </div>
                               
                               <div className="w-20 text-right">
                                 <span className="font-black text-black text-lg">${((ig.recipeCost||0) * ig.qty).toFixed(1)}</span>
                               </div>

                               <button onClick={() => handleRemoveIngredient(cat.id, ig.id)} className="text-neutral-400 hover:text-black transition-colors p-2">
                                 <Trash2 size={16} />
                               </button>
                             </div>
                           </div>
                        ))}
                        {cat.items.length === 0 && (
                           <div className="text-center py-6 border border-dashed border-neutral-300 rounded-[16px] text-[#7F7F7F] font-bold text-sm bg-transparent">
                             此分類尚無食材
                           </div>
                        )}
                     </div>
                  </div>
                )})}
                {updatedCategories.length === 0 && (
                  <div className="text-center py-20 bg-[#F5F5F5] rounded-[24px]">
                     <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><Layers size={24} className="text-black" /></div>
                     <p className="text-black font-black text-xl mb-4 tracking-tight">尚未建立任何分類</p>
                     <button onClick={handleAddCategory} className="bg-black text-white px-6 py-3 rounded-full font-bold transition-all shadow-[0_10px_20px_rgba(0,0,0,0.08)] hover:bg-neutral-800">
                        新增第一個分類
                     </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#F5F5F5] p-6 md:p-8 flex flex-col xl:flex-row justify-between items-center gap-6 rounded-b-[32px]">
              <div className="flex gap-6 sm:gap-10 w-full xl:w-auto flex-wrap">
                <div>
                  <span className="block text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest mb-1">食材總成本</span>
                  <span className="text-2xl font-black text-black">${totalIngredientsCost.toFixed(1)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest mb-1">營業稅 ({globalSettings.taxRate}%)</span>
                  <span className="text-2xl font-black text-black">${taxAmount.toFixed(1)}</span>
                </div>
                <div className="pl-6 sm:pl-10 border-l border-neutral-300">
                  <span className="block text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest mb-1">總成本 (含稅)</span>
                  <span className="text-2xl font-black text-black">${totalCost.toFixed(1)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest mb-1">預估毛利率</span>
                  <span className={`text-2xl font-black ${margin >= 60 ? 'text-black' : margin >= 40 ? 'text-neutral-500' : 'text-red-500'}`}>
                    {margin}%
                  </span>
                </div>
              </div>
              <button onClick={handleSaveMenu} className="w-full xl:w-auto bg-black hover:bg-neutral-800 text-white px-10 py-4 rounded-full font-bold text-lg shadow-[0_10px_20px_rgba(0,0,0,0.1)] transition-all flex items-center justify-center gap-2">
                儲存商品配方
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabSetMenus}</h2>
            <p className="text-[#7F7F7F] font-medium text-sm mt-2 tracking-wide">管理組合商品結構與毛利。</p>
          </div>
          <button 
            onClick={() => setEditingMenu({ id: `sm-${Date.now()}`, name: '未命名新商品', sellingPrice: 0, categories: [] })}
            className="bg-black hover:bg-neutral-800 text-white px-6 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.1)] transition-all"
          >
            <Plus size={16} strokeWidth={3} /> 新增商品
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {setMenus.map(menu => {
            let totalIngredientsCost = 0; let totalItemsCount = 0;
            (menu.categories || []).forEach(cat => {
               (cat.items || []).forEach(ig => {
                  const latestInfo = allAvailableIngredients.find(a => a.name === ig.itemName && a.vendorName === ig.vendorName) || ig;
                  totalIngredientsCost += (latestInfo.recipeCost || latestInfo.finalCost || 0) * ig.qty;
                  totalItemsCount += 1;
               });
            });
            const taxAmount = (menu.sellingPrice || 0) * (globalSettings.taxRate / 100);
            const totalCost = totalIngredientsCost + taxAmount;
            const margin = menu.sellingPrice > 0 ? (((menu.sellingPrice - totalCost) / menu.sellingPrice) * 100).toFixed(1) : 0;
            
            return (
              <div key={menu.id} className="bg-white rounded-[32px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 flex flex-col hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-[#F5F5F5] rounded-full flex items-center justify-center"><Utensils size={20} className="text-black" strokeWidth={1.5}/></div>
                  <button onClick={() => setEditingMenu(menu)} className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-black bg-[#F5F5F5] rounded-full transition-colors"><Edit2 size={16} /></button>
                </div>
                <h3 className="text-2xl font-black text-black mb-3 tracking-tight">{menu.name}</h3>
                <div className="flex items-center gap-2 mb-8 border-b border-neutral-100 pb-6">
                   <span className="bg-[#F5F5F5] text-[#7F7F7F] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">{(menu.categories || []).length} 個分類</span>
                   <span className="text-xs font-bold text-neutral-400">{totalItemsCount} 項食材</span>
                </div>
                
                <div className="mt-auto space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest">終端售價</span>
                    <span className="font-black text-black text-lg">${menu.sellingPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest">總成本</span>
                    <span className="font-black text-black text-lg">${totalCost.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#F5F5F5] px-5 py-4 rounded-[20px]">
                    <span className="text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest">毛利率</span>
                    <span className={`font-black text-xl ${margin >= 60 ? 'text-black' : margin >= 40 ? 'text-neutral-500' : 'text-red-500'}`}>{margin}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          {setMenus.length === 0 && (
            <div className="col-span-full text-center py-24 text-[#7F7F7F] font-medium rounded-[32px] bg-[#F5F5F5]">
              目前尚未建立任何商品配方。
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIngredientsTab = () => {
    if (searchQuery.trim() !== '') {
      return (
        <div className="pb-24 md:pb-8">
          <h2 className="text-[#7F7F7F] text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-widest">
            <Search className="w-4 h-4" /> 搜尋結果： "{searchQuery}" ({searchResults.length})
          </h2>
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(item => <IngredientCard key={item.id} item={item} categoryName={item.categoryName} vendorName={item.vendorName} />)}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-[32px] border border-neutral-100">
              <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4"><Package className="w-6 h-6 text-black" strokeWidth={1.5}/></div>
              <p className="text-[#7F7F7F] font-bold">找不到相關食材</p>
            </div>
          )}
        </div>
      );
    }

    if (selectedVendor) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-24 md:pb-8">
          <div className="flex items-center gap-3 mb-8 text-xs font-bold uppercase tracking-widest">
            <button onClick={() => { setSelectedVendor(null); setSelectedCategory(null); }} className="text-[#7F7F7F] hover:text-black transition-colors">分類總覽</button>
            <span className="text-neutral-300">/</span>
            <button onClick={() => setSelectedVendor(null)} className="text-[#7F7F7F] hover:text-black transition-colors">{selectedCategory.category}</button>
            <span className="text-neutral-300">/</span>
            <span className="text-black">{selectedVendor.vendorName}</span>
          </div>
          
          <div className="flex items-center mb-10 bg-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100">
            <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mr-6"><Store className="w-6 h-6 text-black" strokeWidth={1.5} /></div>
            <div>
              <h2 className="text-3xl font-black text-black tracking-tight">{selectedVendor.vendorName}</h2>
              <p className="text-sm font-bold text-[#7F7F7F] mt-1">提供 {selectedVendor.items.length} 項供應食材</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedVendor.items.map(item => <IngredientCard key={item.id} item={item} />)}
          </div>
        </div>
      );
    }

    if (selectedCategory) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-24 md:pb-8">
          <button onClick={() => setSelectedCategory(null)} className="flex items-center text-[#7F7F7F] hover:text-black font-bold mb-8 transition-all w-fit">
             <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center mr-3 border border-neutral-100"><ChevronLeft className="w-4 h-4" /></div>
             返回食材分類
          </button>
          
          <div className="flex items-center mb-10">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-neutral-100 mr-6`}>
              {getIconByCategory(selectedCategory.category)}
            </div>
            <div>
              <h2 className="text-3xl font-black text-black tracking-tight">{selectedCategory.category}</h2>
              <p className="text-sm font-bold text-[#7F7F7F] mt-1 uppercase tracking-widest">請選擇進貨廠商</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {selectedCategory.vendors.map((vendor, idx) => (
              <button 
                key={idx} onClick={() => setSelectedVendor(vendor)}
                className="bg-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-black transition-all group text-left flex flex-col justify-between"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 bg-[#F5F5F5] rounded-full flex items-center justify-center group-hover:bg-black transition-colors"><Store className="w-5 h-5 text-black group-hover:text-white" strokeWidth={1.5} /></div>
                  <div className="bg-[#F5F5F5] text-[#7F7F7F] text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">{selectedCategory.category}</div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-black mb-2 tracking-tight">{vendor.vendorName}</h3>
                  <p className="text-sm text-[#7F7F7F] font-bold pt-4 flex items-center justify-between">
                    {vendor.items.length} 項食材 <ChevronRight size={16} className="text-neutral-300 group-hover:translate-x-1 group-hover:text-black transition-all"/>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabIngredients}</h2>
          <p className="text-[#7F7F7F] font-medium text-sm mt-2 tracking-wide">請選擇食材分類以檢視廠商報價。</p>
        </div>
        
        {erpData.length === 0 ? (
          <div className="col-span-full text-center py-20 text-[#7F7F7F] font-bold border-2 border-dashed border-neutral-200 rounded-[2rem] bg-white">
            目前沒有從進貨系統讀取到任何食材。<br/>請確認進貨系統是否有建立單據。
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {erpData.map(category => (
              <button
                key={category.id} onClick={() => setSelectedCategory(category)}
                className={`bg-white border border-neutral-100 p-6 sm:p-8 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all flex flex-col items-center justify-center text-center group`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 bg-[#F5F5F5]`}>
                  {getIconByCategory(category.category)}
                </div>
                <h3 className="font-black text-black text-lg tracking-tight">{category.category}</h3>
                <p className="text-[10px] text-[#7F7F7F] font-bold mt-3 bg-white px-3 py-1 rounded-full uppercase tracking-widest border border-neutral-100 shadow-sm">{category.vendors.length} 家廠商</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const navItems = [
    { id: 'ingredients', icon: <Layers size={20} strokeWidth={2} />, label: texts.tabIngredients },
    { id: 'setMenus', icon: <Utensils size={20} strokeWidth={2} />, label: texts.tabSetMenus },
    { id: 'settings', icon: <Settings size={20} strokeWidth={2} />, label: texts.tabSettings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black flex font-sans selection:bg-neutral-200">
      <aside className="hidden md:flex flex-col w-[280px] bg-white fixed h-full z-40 border-r border-neutral-100 shadow-[10px_0_30px_rgba(0,0,0,0.02)]">
        <button onClick={openUIEditor} className="p-8 flex items-center gap-4 hover:bg-neutral-50 transition-colors w-full text-left group">
          <div className="w-10 h-10 bg-black rounded-[14px] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0"><Calculator className="w-5 h-5 text-white" strokeWidth={2} /></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-black tracking-tighter uppercase truncate">{globalSettings.systemName || 'FINERP'}</h1>
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">點擊修改設定</span>
          </div>
        </button>
        
        <nav className="flex-1 px-6 space-y-3 mt-4">
          <p className="px-2 text-[10px] font-bold text-[#7F7F7F] uppercase tracking-[0.2em] mb-4">{texts.sidebarMenu}</p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentTab(item.id); setSearchQuery(''); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold transition-all text-sm tracking-wide ${
                currentTab === item.id 
                ? 'bg-black text-white shadow-[0_10px_20px_rgba(0,0,0,0.1)]' 
                : 'text-[#7F7F7F] hover:bg-[#F5F5F5] hover:text-black'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-6">
          <div className="bg-[#F5F5F5] p-5 rounded-[24px]">
             <div className="text-[10px] text-[#7F7F7F] font-bold uppercase tracking-widest mb-2">{texts.statusTitle}</div>
             <div className="flex items-center gap-2 text-xs font-black text-black uppercase tracking-wide">
               <div className="w-2 h-2 rounded-full bg-black animate-pulse"></div>
               {texts.statusText}
             </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <header className="bg-[#F5F5F5]/80 backdrop-blur-xl sticky top-0 z-30 px-4 py-4 md:px-10 md:py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            
            <div className="flex md:hidden justify-between items-center w-full bg-white p-4 rounded-[24px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100">
              <button onClick={openUIEditor} className="flex items-center gap-3 w-fit text-left active:scale-95 transition-transform group">
                <div className="w-8 h-8 bg-black rounded-[10px] flex items-center justify-center shrink-0"><Calculator className="w-4 h-4 text-white" /></div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black text-black tracking-tighter uppercase truncate max-w-[150px]">{globalSettings.systemName || 'FINERP'}</h1>
                  <span className="text-[8px] text-neutral-400 font-bold block -mt-0.5 leading-none uppercase">介面文字設定</span>
                </div>
              </button>
              <button onClick={() => handleSync(false)} disabled={isSyncing} className={`w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F5F5] text-black ${isSyncing ? 'animate-spin' : ''}`}>
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="flex-1 flex items-center gap-4 w-full justify-between sm:justify-end">
              {currentTab !== 'settings' && (
                <div className="relative w-full sm:max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-[#7F7F7F]" />
                  </div>
                  <input
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-12 pr-5 py-3.5 bg-white border border-neutral-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] rounded-full text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black transition-all font-bold text-sm"
                    placeholder="搜尋食材或分類..."
                  />
                </div>
              )}
              
              <button 
                onClick={() => handleSync(false)} disabled={isSyncing}
                className={`hidden md:flex items-center gap-3 px-6 py-3.5 rounded-full font-bold transition-all bg-white hover:bg-neutral-50 text-black shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-neutral-100
                  ${isSyncing ? 'opacity-50 cursor-wait' : 'active:scale-95'}`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-sm">同步資料庫</span>
              </button>
            </div>
          </div>
          
          {syncMessage && (
            <div className={`mt-4 p-4 rounded-[20px] flex items-center text-sm font-bold max-w-6xl mx-auto shadow-sm
              ${syncMessage.type === 'success' ? 'bg-white text-black border border-neutral-200' : 'bg-[#FEF2F2] border-[#FECACA] border text-[#EF4444]'}`}
            >
              {syncMessage.type === 'success' ? <CheckCircle className="w-5 h-5 mr-3" /> : <AlertCircle className="w-5 h-5 mr-3" />}
              {syncMessage.text}
            </div>
          )}
        </header>

        <main className="flex-1 p-4 md:px-10 md:pb-10 max-w-6xl mx-auto w-full">
          {currentTab === 'ingredients' && renderIngredientsTab()}
          {currentTab === 'setMenus' && renderSetMenuTab()}
          {currentTab === 'settings' && renderSettingsTab()}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-black/95 backdrop-blur-xl rounded-[32px] z-50 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-around items-center p-2">
          {navItems.map(item => (
             <button 
               key={item.id}
               onClick={() => { setCurrentTab(item.id); setSearchQuery(''); }}
               className={`flex flex-col items-center justify-center transition-all w-full py-3 px-2 rounded-[24px] ${currentTab === item.id ? 'bg-white text-black' : 'text-neutral-500'}`}
             >
               <div className="mb-1">{item.icon}</div>
               <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
             </button>
          ))}
        </div>
      </nav>

      {renderUIEditor()}

    </div>
  );
}

function IngredientCard({ item, categoryName, vendorName }) {
  return (
    <div className="bg-white rounded-[32px] border border-neutral-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-black transition-all overflow-hidden flex flex-col group">
      <div className="p-6 md:p-8 border-b border-neutral-100 flex flex-col gap-4">
        <div className="flex gap-2">
          {categoryName && <span className="text-[10px] font-bold text-[#7F7F7F] bg-[#F5F5F5] px-3 py-1.5 rounded-full uppercase tracking-widest">{categoryName}</span>}
          {vendorName && <span className="text-[10px] font-bold text-black bg-white border border-neutral-200 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">{vendorName}</span>}
        </div>
        <h3 className="text-2xl font-black text-black leading-tight tracking-tight">{item.name}</h3>
      </div>
      
      <div className="p-6 md:p-8 flex-grow flex flex-col space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
          <span className="text-[#7F7F7F] font-bold uppercase tracking-widest text-[10px]">最新進貨單價</span>
          <span className="font-black text-black text-xl">${item.rawPrice} <span className="text-xs text-[#7F7F7F] font-medium">/{item.unit}</span></span>
        </div>
        
        <div className="bg-[#F5F5F5] rounded-[20px] p-5">
          <span className="block text-[#7F7F7F] font-bold mb-2 text-[10px] uppercase tracking-widest">成本算法</span>
          <span className="text-black font-bold text-sm tracking-wide">{item.calculation}</span>
        </div>
        
        <div className="pt-2 mt-auto flex justify-between items-end">
          <span className="text-[#7F7F7F] text-[10px] font-bold uppercase tracking-widest mb-1.5">精算盤點成本</span>
          <div className="flex items-center text-black">
            <DollarSign className="w-5 h-5 mr-0.5 opacity-40" />
            <span className="text-3xl font-black tracking-tighter">{typeof item.finalCost === 'number' ? item.finalCost.toFixed(1) : item.finalCost}</span>
            <span className="text-sm ml-1 font-medium opacity-50">/{item.unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
