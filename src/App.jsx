import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, PackagePlus, Truck, CheckSquare, Wifi, WifiOff,
  RefreshCw, Camera, Plus, Trash2, LogOut, Send, CheckCircle2, XCircle,
  Building2, Printer, FileText, X
} from 'lucide-react';

// ============================================================================
// GIỮ NGUYÊN LINK WEB APP (/exec) CỦA BẠN Ở ĐÂY
// ============================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwU3dkJeKZbWIE-iH347USgo9R9FRyG4_chwY3hSyB-8UeHeeZRDmoNevpprXQCxw1p/exec';

const FALLBACK_DB = {
  duAn: [
    { Ma_Du_An: 'CAU_GP9', Ten_Du_An: 'Cầu Gò Dầu - Phước Đông 9', Dia_Diem: 'Tây Ninh' },
    { Ma_Du_An: 'SBLT', Ten_Du_An: 'Dự án Đường SBLT', Dia_Diem: 'Long An' },
    { Ma_Du_An: 'KHO_TONG', Ten_Du_An: 'Kho Tổng Công Ty', Dia_Diem: 'Bình Dương' }
  ],
  vatTu: [
    { Ma_Vat_Tu: 'THEP-D16-CB400', Ten_Vat_Tu: 'Thép thanh vằn D16 CB400-V', Don_Vi_Tinh: 'kg' },
    { Ma_Vat_Tu: 'CAP-DUL-15.2', Ten_Vat_Tu: 'Cáp dự ứng lực 15.24mm', Don_Vi_Tinh: 'met' }
  ],
  thietBi: [
    { Ma_Thiet_Bi: 'MM-KICHDON-YQC25', Ten_Thiet_Bi: 'Kích đơn kéo cáp YQC25', Vi_Tri_Hien_Tai: 'CAU_GP9' },
    { Ma_Thiet_Bi: 'TH-I600-12M', Ten_Thiet_Bi: 'Thép hình I600 dài 12m', Vi_Tri_Hien_Tai: 'SBLT' }
  ],
  nguoiDung: [
    { Ma_NV: 'NV01', Ho_Ten: 'Nguyễn Văn A (Kỹ sư)', Ma_PIN: '1111', Vai_Tro: 'KY_SU', Du_An_Phu_Trach: 'CAU_GP9,SBLT' },
    { Ma_NV: 'NV04', Ho_Ten: 'Phạm Văn D (Giám đốc)', Ma_PIN: '9999', Vai_Tro: 'GIAM_DOC', Du_An_Phu_Trach: 'KHO_TONG,CAU_GP9,SBLT' }
  ],
  giaoDichGanDay: [],
  nhatKyGanDay: []
};

// Hàm tự động chuyển tiếng Việt có dấu thành mã không dấu viết hoa (VD: "Thép D18" -> "THEP-D18")
const toCodeNoDiacritics = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();
};

const compressAndWatermarkImage = (file, watermarkText) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scale = MAX_WIDTH / img.width;
        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height = img.width > MAX_WIDTH ? img.height * scale : img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(watermarkText, 12, canvas.height - 13);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterData, setMasterData] = useState(() => {
    const saved = localStorage.getItem('erp_master_data');
    return saved ? JSON.parse(saved) : FALLBACK_DB;
  });
  const [offlineQueue, setOfflineQueue] = useState(() => {
    const saved = localStorage.getItem('erp_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('erp_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('NHAT_KY'); // NHAT_KY | VAT_TU | THIET_BI | HO_SO | DUYET
  const [selectedProject, setSelectedProject] = useState('');
  const [toast, setToast] = useState(null);
  const [printDoc, setPrintDoc] = useState(null); // Dữ liệu đang mở xem trước bản in A4

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    fetchMasterData();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentUser && !selectedProject) {
      const allowed = currentUser.Du_An_Phu_Trach.split(',').map(s => s.trim());
      setSelectedProject(allowed[0] || 'CAU_GP9');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMasterData = async () => {
    if (!navigator.onLine || API_URL.includes('DIEN_MA_DEPLOY')) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}?action=getInitData`);
      const json = await res.json();
      if (json.status === 'success') {
        setMasterData(json);
        localStorage.setItem('erp_master_data', JSON.stringify(json));
      }
    } catch (e) {
      console.error('Lỗi tải danh mục:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const submitAction = async (action, payload) => {
    const requestItem = { id: Date.now(), action, payload, createdAt: new Date().toLocaleTimeString('vi-VN') };

    if (!isOnline || API_URL.includes('DIEN_MA_DEPLOY')) {
      setOfflineQueue(prev => [...prev, requestItem]);
      showToast('Đang mất mạng: Đã lưu phiếu vào bộ nhớ máy!', 'warning');
      return true;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast('Đã đồng bộ lên hệ thống thành công!');
        fetchMasterData();
        return true;
      } else {
        throw new Error(json.message);
      }
    } catch (err) {
      setOfflineQueue(prev => [...prev, requestItem]);
      showToast('Mạng yếu: Đã lưu tạm vào hàng đợi để gửi sau!', 'warning');
      return true;
    } finally {
      setIsSyncing(false);
    }
  };

  const flushOfflineQueue = async () => {
    if (!isOnline) return showToast('Vẫn chưa có kết nối Internet!', 'error');
    if (offlineQueue.length === 0) return;

    setIsSyncing(true);
    const remaining = [];
    for (const item of offlineQueue) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: item.action, payload: item.payload })
        });
        const json = await res.json();
        if (json.status !== 'success') remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    setOfflineQueue(remaining);
    setIsSyncing(false);
    if (remaining.length === 0) {
      showToast('Đã đồng bộ 100% phiếu ngoại tuyến lên Google Sheets!');
      fetchMasterData();
    } else {
      showToast(`Còn ${remaining.length} phiếu chưa gửi được.`, 'warning');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const targetMaNV = selectedUserId || (masterData.nguoiDung[0]?.Ma_NV || '');
    const user = masterData.nguoiDung.find(
      u => u.Ma_NV === targetMaNV && String(u.Ma_PIN).trim() === pinInput.trim()
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('erp_current_user', JSON.stringify(user));
      setPinInput('');
    } else {
      showToast('Sai mật khẩu / mã PIN của nhân sự này!', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erp_current_user');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-900 text-white rounded-xl mx-auto mb-3">
            <Building2 size={28} />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800">NHẬT KÝ & VẬT TƯ HIỆN TRƯỜNG</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-5">Chọn tên nhân sự và nhập mật khẩu để truy cập</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tài khoản nhân sự</label>
              <select
                value={selectedUserId || (masterData.nguoiDung[0]?.Ma_NV || '')}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:border-blue-800 outline-none"
              >
                {masterData.nguoiDung.map((u) => (
                  <option key={u.Ma_NV} value={u.Ma_NV}>
                    {u.Ho_Ten} ({u.Vai_Tro})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Mật khẩu / Mã PIN</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Nhập mật khẩu..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center text-xl tracking-widest font-bold border-2 border-slate-200 rounded-xl py-2.5 focus:border-blue-800 outline-none"
                autoFocus
              />
            </div>

            <button type="submit" className="w-full bg-blue-900 text-white font-semibold py-3 rounded-xl active:scale-95 transition">
              Đăng nhập
            </button>

            <button
              type="button"
              onClick={fetchMasterData}
              className="w-full text-xs text-blue-700 font-medium py-1 flex items-center justify-center gap-1 hover:underline"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              Cập nhật danh sách nhân sự từ Google Sheets
            </button>
          </form>
        </div>
      </div>
    );
  }

  const allowedProjects = masterData.duAn.filter(d =>
    currentUser.Du_An_Phu_Trach.split(',').map(s => s.trim()).includes(d.Ma_Du_An)
  );
  const canApprove = ['GIAM_DOC', 'THU_KHO'].includes(currentUser.Vai_Tro);
  const currentProjectObj = masterData.duAn.find(d => d.Ma_Du_An === selectedProject) || { Ma_Du_An: selectedProject, Ten_Du_An: selectedProject };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 max-w-lg mx-auto shadow-lg relative">
      {/* MODAL XEM TRƯỚC & IN PDF KHỔ A4 */}
      {printDoc && (
        <PrintA4Modal
          doc={printDoc}
          projectInfo={currentProjectObj}
          onClose={() => setPrintDoc(null)}
        />
      )}

      {/* HEADER CỐ ĐỊNH */}
      <header className="bg-blue-950 text-white p-3 sticky top-0 z-20 shadow no-print">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{currentUser.Ho_Ten}</span>
              <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded-full">{currentUser.Vai_Tro}</span>
            </div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="mt-1 bg-blue-900 text-yellow-300 font-bold text-sm rounded px-2 py-1 border border-blue-700 outline-none"
            >
              {allowedProjects.map(p => (
                <option key={p.Ma_Du_An} value={p.Ma_Du_An}>{p.Ma_Du_An} - {p.Ten_Du_An}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {offlineQueue.length > 0 && (
              <button
                onClick={flushOfflineQueue}
                className="bg-amber-500 text-slate-950 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 animate-pulse"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                Gửi ({offlineQueue.length})
              </button>
            )}
            <button onClick={fetchMasterData} title="Làm mới dữ liệu" className="p-2 bg-blue-900 rounded-lg">
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout} title="Đăng xuất" className="p-2 bg-red-900/60 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] mt-1.5 text-slate-300">
          {isOnline ? <><Wifi size={12} className="text-emerald-400" /> Trực tuyến (Sẵn sàng đồng bộ)</> : <><WifiOff size={12} className="text-amber-400" /> Ngoại tuyến (Tự lưu vào máy)</>}
        </div>
      </header>

      {/* THÔNG BÁO TOAST */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white w-11/12 max-w-md text-center no-print ${
          toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* NỘI DUNG TỪNG TAB */}
      <main className="p-3 no-print">
        {activeTab === 'NHAT_KY' && (
          <DailyLogForm project={selectedProject} user={currentUser} onSubmit={submitAction} />
        )}
        {activeTab === 'VAT_TU' && (
          <MaterialRequestForm
            project={selectedProject}
            user={currentUser}
            vatTuList={masterData.vatTu}
            onSubmit={submitAction}
          />
        )}
        {activeTab === 'THIET_BI' && (
          <EquipmentTransferForm
            project={selectedProject}
            user={currentUser}
            duAnList={masterData.duAn}
            thietBiList={masterData.thietBi}
            onSubmit={submitAction}
          />
        )}
        {activeTab === 'HO_SO' && (
          <DocumentArchive
            project={selectedProject}
            nhatKyList={masterData.nhatKyGanDay}
            giaoDichList={masterData.giaoDichGanDay}
            onPrint={(type, item) => setPrintDoc({ type, item })}
          />
        )}
        {activeTab === 'DUYET' && canApprove && (
          <ApprovalList
            transactions={masterData.giaoDichGanDay}
            user={currentUser}
            onApprove={submitAction}
          />
        )}
      </main>

      {/* THANH ĐIỀU HƯỚNG DƯỚI ĐÁY */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-200 flex justify-around py-2 z-20 no-print">
        <NavButton active={activeTab === 'NHAT_KY'} onClick={() => setActiveTab('NHAT_KY')} icon={<ClipboardList size={20} />} label="Nhật ký" />
        <NavButton active={activeTab === 'VAT_TU'} onClick={() => setActiveTab('VAT_TU')} icon={<PackagePlus size={20} />} label="Vật tư" />
        <NavButton active={activeTab === 'THIET_BI'} onClick={() => setActiveTab('THIET_BI')} icon={<Truck size={20} />} label="Thiết bị" />
        <NavButton active={activeTab === 'HO_SO'} onClick={() => setActiveTab('HO_SO')} icon={<FileText size={20} />} label="In PDF" />
        {canApprove && (
          <NavButton
            active={activeTab === 'DUYET'}
            onClick={() => setActiveTab('DUYET')}
            icon={<CheckSquare size={20} />}
            label="Duyệt"
            badge={masterData.giaoDichGanDay.filter(t => t.Trang_Thai_Duyet === 'Cho_Duyet').length}
          />
        )}
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center relative px-2.5 py-1 rounded-lg ${active ? 'text-blue-900 font-bold' : 'text-slate-500'}`}
    >
      {icon}
      <span className="text-[11px] mt-0.5">{label}</span>
      {badge > 0 && (
        <span className="absolute top-0 right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// COMPONENT 1: FORM NHẬT KÝ THI CÔNG 4 MỤC (HỖ TRỢ UPDATE NỐI TIẾP TRONG NGÀY)
// ============================================================================
function DailyLogForm({ project, projectObj, user, nhatKyList, onSubmit }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);

  // Mục 2: Điều kiện thi công (Thời tiết Sáng / Chiều / Tối + Thời gian mưa)
  const [weather, setWeather] = useState({
    sang: 'Nắng',
    chieu: 'Râm mát',
    toi: 'Râm mát',
    thoi_gian_mua: ''
  });

  // Mục 3: Nhân sự & Thiết bị
  const [personnel, setPersonnel] = useState({
    cht: 1,
    cbkt: 2,
    cbatld: 1,
    doi_truong: 1,
    cong_nhan: 12
  });
  const [equipments, setEquipments] = useState([{ ten: '', sl: 1 }]);

  // Mục 4: Nội dung công việc, khó khăn, đề xuất, sự cố
  const [tasks, setTasks] = useState([{ hang_muc: '', kl: '' }]);
  const [khoKhanSuCo, setKhoKhanSuCo] = useState('');

  // Ảnh hiện trường (Ảnh đã lưu trên Drive + Ảnh mới chụp thêm)
  const [existingUrls, setExistingUrls] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const fileRef = useRef();

  // Tự động kiểm tra xem ngày đang chọn đã có nhật ký chưa để nạp lên cho phép Update tiếp
  useEffect(() => {
    const found = (nhatKyList || []).find(
      (n) => n.Ma_Du_An === project && String(n.Ngay_Thi_Cong).startsWith(date)
    );

    if (found) {
      // Nạp thời tiết
      try {
        const w = typeof found.Thoi_Tiet === 'string' && found.Thoi_Tiet.startsWith('{')
          ? JSON.parse(found.Thoi_Tiet)
          : { sang: found.Thoi_Tiet || 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '' };
        setWeather({ sang: 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '', ...w });
      } catch {}

      // Nạp nhân sự & thiết bị
      try {
        const res = typeof found.Nhan_Luc_May_Moc === 'string'
          ? JSON.parse(found.Nhan_Luc_May_Moc)
          : (found.Nhan_Luc_May_Moc || {});
        setPersonnel({
          cht: res.cht ?? 1,
          cbkt: res.cbkt ?? (res.ky_su || 2),
          cbatld: res.cbatld ?? 1,
          doi_truong: res.doi_truong ?? 1,
          cong_nhan: res.cong_nhan ?? 12
        });
        if (Array.isArray(res.thiet_bi) && res.thiet_bi.length > 0) {
          setEquipments(res.thiet_bi);
        } else {
          setEquipments([{ ten: res.may || '', sl: 1 }]);
        }
      } catch {}

      // Nạp công việc & khó khăn/sự cố
      try {
        const t = typeof found.Cong_Viec_Thuc_Hien === 'string'
          ? JSON.parse(found.Cong_Viec_Thuc_Hien)
          : found.Cong_Viec_Thuc_Hien;
        if (Array.isArray(t) && t.length > 0) setTasks(t);
      } catch {}

      setKhoKhanSuCo(found.Kien_Nghi_Vuong_Mac || '');
      const urls = String(found.Link_Anh_Hien_Truong || '').trim().split('\n').filter(Boolean);
      setExistingUrls(urls);
      setNewImages([]);
    } else {
      // Reset form trắng cho ngày mới chưa có dữ liệu
      setWeather({ sang: 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '' });
      setPersonnel({ cht: 1, cbkt: 2, cbatld: 1, doi_truong: 1, cong_nhan: 12 });
      setEquipments([{ ten: '', sl: 1 }]);
      setTasks([{ hang_muc: '', kl: '' }]);
      setKhoKhanSuCo('');
      setExistingUrls([]);
      setNewImages([]);
    }
  }, [project, date, nhatKyList]);

  const handleAddEq = () => setEquipments([...equipments, { ten: '', sl: 1 }]);
  const handleEqChange = (idx, field, val) => {
    const copy = [...equipments];
    copy[idx][field] = val;
    setEquipments(copy);
  };

  const handleAddTask = () => setTasks([...tasks, { hang_muc: '', kl: '' }]);
  const handleTaskChange = (idx, field, val) => {
    const copy = [...tasks];
    copy[idx][field] = val;
    setTasks(copy);
  };

  const handleCapture = async (e) => {
    const files = Array.from(e.target.files);
    const stamp = `${project} | ${new Date().toLocaleString('vi-VN')}`;
    const compressed = await Promise.all(files.map((f) => compressAndWatermarkImage(f, stamp)));
    setNewImages((prev) => [...prev, ...compressed]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validTasks = tasks.filter((t) => t.hang_muc.trim() !== '');
    if (validTasks.length === 0) return alert('Vui lòng nhập ít nhất 1 nội dung công việc ở Mục 4!');

    const validEq = equipments.filter((eq) => eq.ten.trim() !== '');

    const ok = await onSubmit('CREATE_DAILY_LOG', {
      Ma_Du_An: project,
      Ngay_Thi_Cong: date,
      Thoi_Tiet: weather,
      Nhan_Luc_May_Moc: {
        ...personnel,
        thiet_bi: validEq
      },
      Cong_Viec_Thuc_Hien: validTasks,
      Kien_Nghi_Vuong_Mac: khoKhanSuCo,
      imagesBase64: newImages,
      Nguoi_Tao: `${user.Ma_NV} - ${user.Ho_Ten}`
    });

    if (ok) {
      setNewImages([]);
    }
  };

  const isUpdating = existingUrls.length > 0 || (nhatKyList || []).some(
    (n) => n.Ma_Du_An === project && String(n.Ngay_Thi_Cong).startsWith(date)
  );
  const weatherOptions = ['Nắng', 'Mưa', 'Râm mát'];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-5">
      <div className="flex justify-between items-center border-b pb-2">
        <h2 className="font-bold text-blue-950 text-base">Nhật ký thi công</h2>
        {isUpdating && (
          <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
            Đang bổ sung ngày {date}
          </span>
        )}
      </div>

      {/* MỤC 1: NGÀY THI CÔNG & TÊN CÔNG TRÌNH */}
      <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 1. Thông tin chung</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Ngày thi công</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm mt-1 bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Tên công trình</label>
            <input
              type="text"
              readOnly
              value={projectObj?.Ten_Du_An || project}
              className="w-full border rounded-lg p-2 text-sm mt-1 bg-slate-100 font-semibold text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* MỤC 2: ĐIỀU KIỆN THI CÔNG (THỜI TIẾT SÁNG / CHIỀU / TỐI) */}
      <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 2. Điều kiện thi công (Thời tiết)</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'sang', label: 'Buổi sáng' },
            { key: 'chieu', label: 'Buổi chiều' },
            { key: 'toi', label: 'Buổi tối' }
          ].map((buoi) => (
            <div key={buoi.key}>
              <label className="text-xs font-semibold text-slate-600">{buoi.label}</label>
              <select
                value={weather[buoi.key]}
                onChange={(e) => setWeather({ ...weather, [buoi.key]: e.target.value })}
                className="w-full border rounded-lg p-2 text-xs font-semibold mt-1 bg-white"
              >
                {weatherOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {(weather.sang === 'Mưa' || weather.chieu === 'Mưa' || weather.toi === 'Mưa' || weather.thoi_gian_mua) && (
          <div>
            <label className="text-xs font-semibold text-slate-600">Thời gian mưa (nếu có)</label>
            <input
              type="text"
              placeholder="VD: Mưa rào từ 14h15 đến 15h30..."
              value={weather.thoi_gian_mua}
              onChange={(e) => setWeather({ ...weather, thoi_gian_mua: e.target.value })}
              className="w-full border rounded-lg p-2 text-xs mt-1 bg-white"
            />
          </div>
        )}
      </div>

      {/* MỤC 3: NHÂN SỰ & THIẾT BỊ */}
      <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 3. Nhân sự và Thiết bị</div>

        {/* 3.1 Nhân sự */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">1. Nhân sự trực tiếp (người)</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'cht', label: 'CHT' },
              { key: 'cbkt', label: 'CBKT' },
              { key: 'cbatld', label: 'CB ATLĐ' },
              { key: 'doi_truong', label: 'Đội trưởng' },
              { key: 'cong_nhan', label: 'Công nhân' }
            ].map((role) => (
              <div key={role.key} className="bg-white border rounded-lg p-1.5">
                <span className="text-[11px] text-slate-500 block">{role.label}</span>
                <input
                  type="number"
                  min="0"
                  value={personnel[role.key]}
                  onChange={(e) => setPersonnel({ ...personnel, [role.key]: Number(e.target.value) })}
                  className="w-full font-bold text-sm text-slate-800 outline-none mt-0.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 3.2 Thiết bị */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-600">2. Thiết bị thi công</label>
            <button type="button" onClick={handleAddEq} className="text-xs bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded flex items-center gap-0.5">
              <Plus size={13} /> Thêm máy
            </button>
          </div>
          {equipments.map((eq, i) => (
            <div key={i} className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                placeholder="Tên thiết bị (VD: Cẩu 50T, Kích DUL...)"
                value={eq.ten}
                onChange={(e) => handleEqChange(i, 'ten', e.target.value)}
                className="flex-1 border rounded-lg p-2 text-xs bg-white"
              />
              <input
                type="number"
                min="1"
                placeholder="SL"
                value={eq.sl}
                onChange={(e) => handleEqChange(i, 'sl', Number(e.target.value))}
                className="w-16 border rounded-lg p-2 text-xs text-center bg-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* MỤC 4: NỘI DUNG CÔNG VIỆC, KHÓ KHĂN, ĐỀ XUẤT, SỰ CỐ */}
      <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 4. Nội dung công việc & Vấn đề phát sinh</div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-600">Công việc thi công hàng ngày</label>
            <button type="button" onClick={handleAddTask} className="text-xs bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded flex items-center gap-0.5">
              <Plus size={13} /> Thêm việc
            </button>
          </div>
          {tasks.map((t, i) => (
            <div key={i} className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                placeholder="Nội dung công việc..."
                value={t.hang_muc}
                onChange={(e) => handleTaskChange(i, 'hang_muc', e.target.value)}
                className="flex-1 border rounded-lg p-2 text-xs bg-white"
              />
              <input
                type="text"
                placeholder="Khối lượng"
                value={t.kl}
                onChange={(e) => handleTaskChange(i, 'kl', e.target.value)}
                className="w-24 border rounded-lg p-2 text-xs bg-white"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Khó khăn, đề xuất, sự cố (nếu có)</label>
          <textarea
            rows="3"
            placeholder="Ghi nhận khó khăn, đề xuất TVGS hoặc sự cố phát sinh trong ngày..."
            value={khoKhanSuCo}
            onChange={(e) => setKhoKhanSuCo(e.target.value)}
            className="w-full border rounded-lg p-2 text-xs mt-1 bg-white"
          />
        </div>
      </div>

      {/* CHỤP ẢNH HIỆN TRƯỜNG (CÓ THỂ UPLOAD NHIỀU LẦN TRONG NGÀY) */}
      <div className="space-y-2">
        <input type="file" accept="image/*" capture="environment" multiple ref={fileRef} onChange={handleCapture} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          className="w-full border-2 border-dashed border-blue-300 bg-blue-50/60 text-blue-900 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs"
        >
          <Camera size={18} /> Chụp / Tải thêm ảnh hiện trường ({newImages.length} ảnh mới)
        </button>

        {existingUrls.length > 0 && (
          <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            ✓ Đã có {existingUrls.length} ảnh lưu trên Drive trong ngày hôm nay (ảnh mới chụp sẽ được nối tiếp vào hồ sơ).
          </div>
        )}

        {newImages.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {newImages.map((src, idx) => (
              <div key={idx} className="relative shrink-0">
                <img src={src} alt="preview" className="w-20 h-20 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setNewImages(newImages.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow">
        <Send size={18} /> {isUpdating ? 'Cập nhật bổ sung Nhật ký' : 'Gửi Nhật ký lên hệ thống'}
      </button>
    </form>
  );
}

// ============================================================================
// COMPONENT 2: PHIẾU YÊU CẦU / NHẬP VẬT TƯ (CÓ NÚT + THÊM VẬT TƯ MỚI)
// ============================================================================
function MaterialRequestForm({ project, user, vatTuList, onSubmit }) {
  const [loai, setLoai] = useState('YEU_CAU_VAT_TU');
  const [maVatTu, setMaVatTu] = useState(vatTuList[0]?.Ma_Vat_Tu || '');
  const [soLuong, setSoLuong] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [image, setImage] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newTenVT, setNewTenVT] = useState('');
  const [newDVT, setNewDVT] = useState('kg');

  const selectedItem = vatTuList.find(v => v.Ma_Vat_Tu === maVatTu);

  const handleImage = async (e) => {
    if (!e.target.files[0]) return;
    const stamp = `${project} | ${loai} | ${new Date().toLocaleString('vi-VN')}`;
    const b64 = await compressAndWatermarkImage(e.target.files[0], stamp);
    setImage(b64);
  };

  const handleQuickAddVT = async () => {
    if (!newTenVT.trim()) return;
    const autoCode = toCodeNoDiacritics(newTenVT);
    await onSubmit('ADD_MASTER_ITEM', {
      type: 'VAT_TU',
      Ma_Vat_Tu: autoCode,
      Ten_Vat_Tu: newTenVT.trim(),
      Don_Vi_Tinh: newDVT
    });
    setMaVatTu(autoCode);
    setNewTenVT('');
    setShowAddNew(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!soLuong || Number(soLuong) <= 0) return alert('Nhập số lượng hợp lệ!');
    const ok = await onSubmit('CREATE_TRANSACTION', {
      Loai_Giao_Dich: loai,
      Tu_Kho: loai === 'NHAP_KHO' ? 'NHA_CUNG_CAP' : 'KHO_TONG',
      Den_Kho: project,
      Ma_Doi_Tuong: maVatTu,
      So_Luong: Number(soLuong),
      Ghi_Chu: ghiChu,
      imageBase64: image,
      Nguoi_Tao: `${user.Ma_NV} - ${user.Ho_Ten}`,
      Vai_Tro: user.Vai_Tro
    });
    if (ok) {
      setSoLuong('');
      setGhiChu('');
      setImage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="font-bold text-blue-950 text-base border-b pb-2">2. Phiếu Vật tư</h2>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setLoai('YEU_CAU_VAT_TU')} className={`py-2 rounded-lg text-xs font-bold border ${loai === 'YEU_CAU_VAT_TU' ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-700'}`}>
          Đề xuất cấp vật tư
        </button>
        <button type="button" onClick={() => setLoai('NHAP_KHO')} className={`py-2 rounded-lg text-xs font-bold border ${loai === 'NHAP_KHO' ? 'bg-emerald-700 text-white' : 'bg-slate-50 text-slate-700'}`}>
          Xác nhận nhập kho
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-600">Chọn vật tư</label>
          <button type="button" onClick={() => setShowAddNew(!showAddNew)} className="text-xs text-blue-800 font-bold flex items-center gap-0.5">
            <Plus size={14} /> Thêm vật tư mới
          </button>
        </div>

        {showAddNew && (
          <div className="bg-blue-50 p-2.5 rounded-xl mt-1.5 space-y-2 border border-blue-200">
            <input type="text" placeholder="Tên vật tư (VD: Thép D18 CB400)" value={newTenVT} onChange={e => setNewTenVT(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-white" />
            <div className="flex gap-2">
              <input type="text" placeholder="ĐVT (kg, m3, cai)" value={newDVT} onChange={e => setNewDVT(e.target.value)} className="w-24 border rounded p-1.5 text-xs bg-white" />
              <button type="button" onClick={handleQuickAddVT} className="flex-1 bg-blue-900 text-white text-xs font-bold rounded py-1.5">
                Lưu vào danh mục
              </button>
            </div>
          </div>
        )}

        <select value={maVatTu} onChange={e => setMaVatTu(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1 bg-white">
          {vatTuList.map(v => (
            <option key={v.Ma_Vat_Tu} value={v.Ma_Vat_Tu}>{v.Ma_Vat_Tu} - {v.Ten_Vat_Tu} ({v.Don_Vi_Tinh})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600">Số lượng ({selectedItem?.Don_Vi_Tinh || 'đơn vị'})</label>
        <input type="number" step="any" placeholder="VD: 5000" value={soLuong} onChange={e => setSoLuong(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600">Hạng mục sử dụng / Ghi chú</label>
        <input type="text" placeholder="VD: Thép mố M1, đợt 2..." value={ghiChu} onChange={e => setGhiChu(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Ảnh phiếu giao hàng / Ký nhận (nếu có)</label>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} className="text-xs" />
      </div>

      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow">
        <Send size={18} /> Gửi phiếu vật tư
      </button>
    </form>
  );
}

// ============================================================================
// COMPONENT 3: ĐIỀU CHUYỂN THIẾT BỊ GIỮA CÁC CÔNG TRƯỜNG
// ============================================================================
function EquipmentTransferForm({ project, user, duAnList, thietBiList, onSubmit }) {
  const [maThietBi, setMaThietBi] = useState(thietBiList[0]?.Ma_Thiet_Bi || '');
  const [denKho, setDenKho] = useState('SBLT');
  const [ghiChu, setGhiChu] = useState('');

  const selectedEq = thietBiList.find(t => t.Ma_Thiet_Bi === maThietBi);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tuKho = selectedEq?.Vi_Tri_Hien_Tai || project;
    if (tuKho === denKho) return alert('Nơi nhận phải khác vị trí hiện tại của thiết bị!');

    const ok = await onSubmit('CREATE_TRANSACTION', {
      Loai_Giao_Dich: 'DIEU_CHUYEN',
      Tu_Kho: tuKho,
      Den_Kho: denKho,
      Ma_Doi_Tuong: maThietBi,
      So_Luong: 1,
      Ghi_Chu: ghiChu,
      Nguoi_Tao: `${user.Ma_NV} - ${user.Ho_Ten}`,
      Vai_Tro: user.Vai_Tro
    });
    if (ok) setGhiChu('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="font-bold text-blue-950 text-base border-b pb-2">3. Điều chuyển Máy & Thiết bị</h2>

      <div>
        <label className="text-xs font-semibold text-slate-600">Chọn thiết bị cần điều chuyển</label>
        <select value={maThietBi} onChange={e => setMaThietBi(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1 bg-white">
          {thietBiList.map(tb => (
            <option key={tb.Ma_Thiet_Bi} value={tb.Ma_Thiet_Bi}>
              {tb.Ma_Thiet_Bi} - {tb.Ten_Thiet_Bi} [Đang ở: {tb.Vi_Tri_Hien_Tai}]
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border">
        <div>
          <span className="text-[11px] text-slate-500">Từ công trường/kho</span>
          <div className="font-bold text-sm text-slate-800">{selectedEq?.Vi_Tri_Hien_Tai || project}</div>
        </div>
        <div>
          <span className="text-[11px] text-slate-500">Chuyển đến</span>
          <select value={denKho} onChange={e => setDenKho(e.target.value)} className="w-full border rounded p-1 text-sm font-bold text-blue-900 bg-white mt-0.5">
            {duAnList.map(d => (
              <option key={d.Ma_Du_An} value={d.Ma_Du_An}>{d.Ma_Du_An}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600">Lý do điều chuyển / Tình trạng máy</label>
        <input type="text" placeholder="VD: Chuyển sang phục vụ căng kéo nhịp 2..." value={ghiChu} onChange={e => setGhiChu(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
      </div>

      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow">
        <Truck size={18} /> Lập lệnh điều chuyển
      </button>
    </form>
  );
}

// ============================================================================
// COMPONENT 4: LỊCH SỬ HỒ SƠ & IN PDF KHỔ A4 CHUẨN NGHỊ ĐỊNH (ĐÃ LỌC GỌN)
// ============================================================================
function DocumentArchive({ project, nhatKyList, giaoDichList, onPrint }) {
  const [searchTerm, setSearchTerm] = useState('');

  const keyword = searchTerm.trim().toLowerCase();

  const projectLogs = nhatKyList
    .filter((n) => n.Ma_Du_An === project)
    .filter((n) =>
      !keyword ||
      String(n.Ma_Nhat_Ky || '').toLowerCase().includes(keyword) ||
      String(n.Ngay_Thi_Cong || '').toLowerCase().includes(keyword)
    );

  const projectTx = giaoDichList
    .filter((g) => g.Den_Kho === project || g.Tu_Kho === project)
    .filter((g) =>
      !keyword ||
      String(g.Ma_Phieu || '').toLowerCase().includes(keyword) ||
      String(g.Ma_Doi_Tuong || '').toLowerCase().includes(keyword) ||
      String(g.Ngay_Chung_Tu || '').toLowerCase().includes(keyword)
    );

  const renderStatusBadge = (status) => {
    if (status === 'Da_Duyet') {
      return <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Đã duyệt</span>;
    }
    if (status === 'Tu_Choi') {
      return <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Từ chối</span>;
    }
    return <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Chờ duyệt</span>;
  };

  return (
    <div className="space-y-4">
      {/* Ô tìm kiếm nhanh hồ sơ theo ngày hoặc mã */}
      <input
        type="text"
        placeholder="Tìm nhanh theo ngày (VD: 2026-11-24) hoặc mã phiếu..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-sm outline-none focus:border-blue-800"
      />

      {/* DANH SÁCH NHẬT KÝ THI CÔNG */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-bold text-blue-950 text-sm">Nhật ký thi công gần đây</h2>
          <span className="text-[11px] text-slate-400 font-medium">{projectLogs.length} bản ghi</span>
        </div>

        {projectLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">Không có nhật ký nào phù hợp.</p>
        ) : (
          projectLogs.map((log) => (
            <div key={log.Ma_Nhat_Ky} className="flex justify-between items-center border-b py-2.5 last:border-0 gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 truncate">{log.Ma_Nhat_Ky}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  Ngày: {log.Ngay_Thi_Cong} • {log.Thoi_Tiet}
                </div>
              </div>
              <button
                onClick={() => onPrint('NHAT_KY', log)}
                className="shrink-0 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition"
              >
                <Printer size={14} /> Xuất A4
              </button>
            </div>
          ))
        )}
      </div>

      {/* DANH SÁCH PHIẾU VẬT TƯ & ĐIỀU CHUYỂN */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-bold text-blue-950 text-sm">Phiếu Vật tư & Điều chuyển</h2>
          <span className="text-[11px] text-slate-400 font-medium">{projectTx.length} phiếu</span>
        </div>

        {projectTx.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">Không có phiếu nào phù hợp.</p>
        ) : (
          projectTx.map((tx) => (
            <div key={tx.Ma_Phieu} className="flex justify-between items-center border-b py-2.5 last:border-0 gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-slate-800">{tx.Ma_Phieu}</span>
                  {renderStatusBadge(tx.Trang_Thai_Duyet)}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {tx.Ma_Doi_Tuong} • SL: <strong className="text-slate-700">{tx.So_Luong}</strong> ({tx.Ngay_Chung_Tu})
                </div>
              </div>
              <button
                onClick={() => onPrint('PHIEU', tx)}
                className="shrink-0 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition"
              >
                <Printer size={14} /> Xuất A4
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT 5: DUYỆT PHIẾU (BAN GIÁM ĐỐC & THỦ KHO)
// ============================================================================
function ApprovalList({ transactions, user, onApprove }) {
  const pending = transactions.filter(t => t.Trang_Thai_Duyet === 'Cho_Duyet');

  const handleDecision = (maPhieu, status) => {
    onApprove('APPROVE_TRANSACTION', {
      Ma_Phieu: maPhieu,
      Trang_Thai_Moi: status,
      Nguoi_Duyet: `${user.Ma_NV} - ${user.Ho_Ten}`
    });
  };

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-blue-950 text-base">Phiếu chờ phê duyệt ({pending.length})</h2>
      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-sm">
          Tất cả phiếu đề xuất đều đã được xử lý!
        </div>
      ) : (
        pending.map(item => (
          <div key={item.Ma_Phieu} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-500 space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-sm text-blue-950">{item.Ma_Phieu}</span>
              <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">{item.Loai_Giao_Dich}</span>
            </div>
            <div className="text-sm text-slate-700">
              <div><strong>Đối tượng:</strong> {item.Ma_Doi_Tuong} — SL: <strong className="text-blue-900">{item.So_Luong}</strong></div>
              <div><strong>Luồng kho:</strong> {item.Tu_Kho || 'N/A'} ➔ <strong>{item.Den_Kho}</strong></div>
              <div className="text-xs text-slate-500 mt-1">Người lập: {item.Nguoi_Tao} ({item.Ngay_Chung_Tu})</div>
              {item.Ghi_Chu_Anh && <div className="text-xs italic text-slate-600 mt-1">"{item.Ghi_Chu_Anh}"</div>}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleDecision(item.Ma_Phieu, 'Da_Duyet')}
                className="bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"
              >
                <CheckCircle2 size={16} /> Phê duyệt
              </button>
              <button
                onClick={() => handleDecision(item.Ma_Phieu, 'Tu_Choi')}
                className="bg-red-100 text-red-700 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"
              >
                <XCircle size={16} /> Từ chối
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT 6: BẢN IN HÀNH CHÍNH KHỔ A4 (CHUẨN NGHỊ ĐỊNH 06/2021 & 30/2020)
// ============================================================================
function PrintA4Modal({ doc, projectInfo, onClose }) {
  const { type, item } = doc;
  let tasks = [];
  let resources = {};

  let weatherObj = { sang: '', chieu: '', toi: '', thoi_gian_mua: '' };
  if (type === 'NHAT_KY') {
    try {
      weatherObj = typeof item.Thoi_Tiet === 'string' && item.Thoi_Tiet.startsWith('{')
        ? JSON.parse(item.Thoi_Tiet)
        : { sang: item.Thoi_Tiet || '', chieu: '', toi: '', thoi_gian_mua: '' };
    } catch {}
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 overflow-y-auto p-2 flex flex-col items-center">
      {/* Thanh công cụ trên cùng (ẩn khi in) */}
      <div className="w-full max-w-2xl bg-slate-800 text-white p-3 rounded-t-xl flex justify-between items-center no-print">
        <span className="text-xs font-bold">Xem trước bản in khổ A4 (Bấm In &gt; Lưu thành PDF để gửi Zalo)</span>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
            <Printer size={15} /> In / Lưu PDF
          </button>
          <button onClick={onClose} className="bg-slate-600 px-2.5 py-1.5 rounded-lg text-xs">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* VÙNG GIẤY A4 CHUẨN */}
      <div id="print-area" className="bg-white w-full max-w-2xl p-6 text-black text-sm leading-relaxed shadow-2xl">
        <div className="flex justify-between text-center border-b border-black pb-3 mb-4">
          <div className="w-5/12">
            <div className="font-bold uppercase text-xs">ĐƠN VỊ THI CÔNG</div>
            <div className="text-xs mt-0.5">Ban Điều Hành Dự Án {projectInfo.Ma_Du_An}</div>
          </div>
          <div className="w-7/12">
            <div className="font-bold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-bold text-xs underline">Độc lập - Tự do - Hạnh phúc</div>
          </div>
        </div>

        {type === 'NHAT_KY' ? (
          <>
            <h1 className="text-center font-bold text-base uppercase mt-2">NHẬT KÝ THI CÔNG XÂY DỰNG CÔNG TRÌNH</h1>
            <p className="text-center italic text-xs mb-4">(Theo Nghị định số 06/2021/NĐ-CP của Chính phủ)</p>

            {/* MỤC 1 */}
            <div className="space-y-1 text-xs mb-3">
              <div><strong>Mục 1. Tên công trình:</strong> {projectInfo.Ten_Du_An} ({projectInfo.Ma_Du_An})</div>
              <div className="pl-3"><strong>Ngày thi công:</strong> {item.Ngay_Thi_Cong} — <strong>Mã nhật ký:</strong> {item.Ma_Nhat_Ky}</div>
            </div>

            {/* MỤC 2 */}
            <div className="space-y-1 text-xs mb-3">
              <div>
                <strong>Mục 2. Điều kiện thi công (Thời tiết):</strong> Sáng: {weatherObj.sang || '---'}; Chiều: {weatherObj.chieu || '---'}; Tối: {weatherObj.toi || '---'}.
              </div>
              {weatherObj.thoi_gian_mua && (
                <div className="pl-3"><strong>Thời gian mưa:</strong> {weatherObj.thoi_gian_mua}</div>
              )}
            </div>

            {/* MỤC 3 */}
            <div className="space-y-1.5 text-xs mb-3">
              <div><strong>Mục 3. Nhân sự và Thiết bị thi công:</strong></div>
              <div className="pl-3">
                - <em>Nhân sự:</em> CHT: {resources.cht ?? 0}; CBKT: {resources.cbkt ?? (resources.ky_su || 0)}; CB ATLĐ: {resources.cbatld ?? 0}; Đội trưởng: {resources.doi_truong ?? 0}; Công nhân: {resources.cong_nhan ?? 0} người.
              </div>
              <div className="pl-3">
                - <em>Thiết bị thi công:</em>{' '}
                {Array.isArray(resources.thiet_bi) && resources.thiet_bi.length > 0
                  ? resources.thiet_bi.map((eq) => `${eq.ten} (${eq.sl})`).join(', ')
                  : (resources.may || 'Theo dây chuyền thi công')}
              </div>
            </div>

            {/* MỤC 4 */}
            <div className="font-bold text-xs mb-1">Mục 4. Nội dung công việc thi công & Vấn đề phát sinh:</div>
            <table className="w-full border-collapse border border-black text-xs mb-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1.5 w-10">STT</th>
                  <th className="border border-black p-1.5 text-left">Nội dung công việc thi công hàng ngày</th>
                  <th className="border border-black p-1.5 w-28">Khối lượng</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5">{t.hang_muc}</td>
                    <td className="border border-black p-1.5 text-center">{t.kl}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs mb-6">
              <strong>Khó khăn, đề xuất, sự cố trong ngày:</strong>
              <p className="mt-1 border border-black p-2 min-h-[48px]">{item.Kien_Nghi_Vuong_Mac || 'Thi công bình thường, đảm bảo an toàn và tiến độ.'}</p>
            </div>

            <div className="grid grid-cols-2 text-center text-xs mt-8">
              <div>
                <div className="font-bold uppercase">ĐẠI DIỆN NHÀ THẦU THI CÔNG</div>
                <div className="italic text-[11px]">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>
              <div>
                <div className="font-bold uppercase">TƯ VẤN GIÁM SÁT HIỆN TRƯỜNG</div>
                <div className="italic text-[11px]">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>
            </div>
          </>
        ) : ( ... )}