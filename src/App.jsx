import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const [view, setView] = useState('home');
  
  // State Guru
  const [teacherPass, setTeacherPass] = useState('');
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [rawExcel, setRawExcel] = useState('');
  
  // State Filter & Pencarian Guru
  const [searchName, setSearchName] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // State Pengaturan Ujian (Active Exam)
  const [examConfig, setExamConfig] = useState({
    title: 'Ulangan Harian Sistem Starter',
    subject: 'Pemeliharaan Kelistrikan',
    targetClass: 'XI TKR A',
    duration: 30,
    totalQuestions: 20,
    isRandom: true
  });

  // State Siswa
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('XI TKR A');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [scoreData, setScoreData] = useState(null);
  const [activeQuestions, setActiveQuestions] = useState([]);

  // --- Fungsi Database ---
  const fetchQuestions = async () => {
    const snap = await getDocs(collection(db, "questions"));
    setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchResults = async () => {
    const snap = await getDocs(collection(db, "results"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Urutkan dari yang terbaru
    setResults(data.sort((a, b) => b.timestamp - a.timestamp)); 
  };

  const fetchExamConfig = async () => {
    const docRef = doc(db, "settings", "activeExam");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setExamConfig(docSnap.data());
    }
  };

  // --- Logika Guru ---
  const loginTeacher = (e) => {
    e.preventDefault();
    if (teacherPass === 'admin123') { 
      setView('dashboard'); 
      fetchQuestions(); 
      fetchResults();
      fetchExamConfig();
    } else {
      alert('Password salah!');
    }
  };

  const saveExamConfig = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, "settings", "activeExam"), examConfig);
    alert('Pengaturan Ujian berhasil disimpan!');
  };

  const handleImport = async () => {
    if (!rawExcel) return alert('Data kosong!');
    const rows = rawExcel.split('\n');
    let count = 0;
    for (let row of rows) {
      const cols = row.split('\t'); 
      if (cols.length >= 7) {
        await addDoc(collection(db, "questions"), {
          question: cols[1]?.trim(), 
          option_a: cols[2]?.trim(), 
          option_b: cols[3]?.trim(), 
          option_c: cols[4]?.trim(), 
          option_d: cols[5]?.trim(), 
          option_e: cols[6]?.trim(), 
          answer_key: cols[7]?.trim().toUpperCase(),
          image: cols[8]?.trim() || '' // Link gambar (opsional) di kolom ke-9
        });
        count++;
      }
    }
    setRawExcel('');
    alert(`${count} Soal berhasil diimport ke database!`);
    fetchQuestions();
  };

  // Filter Hasil
  const filteredResults = results.filter(r => 
    r.name?.toLowerCase().includes(searchName.toLowerCase()) &&
    (filterClass === '' || r.class === filterClass)
  );

  const exportToExcel = () => {
    const csvHeader = "Nama,Kelas,Nilai,Benar,Salah,Tanggal\n";
    const csvData = filteredResults.map(r => `${r.name},${r.class},${r.score},${r.correct},${r.wrong},${r.date}`).join("\n");
    const blob = new Blob([csvHeader + csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Rekap_Nilai_CBT.csv";
    link.click();
  };

  // --- Logika Siswa ---
  const prepareStudentLogin = async () => {
    await fetchExamConfig();
    setView('student_login');
  };

  const startExam = async (e) => {
    e.preventDefault();
    if (!studentName) return alert('Nama harus diisi!');
    
    const snap = await getDocs(collection(db, "questions"));
    let allQ = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Logika Paket Acak
    if (examConfig.isRandom) {
      allQ = allQ.sort(() => 0.5 - Math.random()); 
    }
    
    // Batasi jumlah soal sesuai pengaturan
    const finalQ = allQ.slice(0, examConfig.totalQuestions);
    
    if (finalQ.length === 0) return alert('Belum ada soal di database! Harap lapor ke Guru.');

    setActiveQuestions(finalQ);
    setTimeLeft(examConfig.duration * 60);
    setAnswers({});
    setCurrentQ(0);
    setView('exam');
  };

  // Timer Otomatis
  useEffect(() => {
    if (view === 'exam' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (view === 'exam' && timeLeft === 0) {
      submitExam(); // Kumpulkan otomatis saat waktu habis
    }
  }, [view, timeLeft]);

  const submitExam = async () => {
    let correct = 0;
    activeQuestions.forEach((q, i) => { 
      if (answers[i] === q.answer_key) correct++; 
    });
    
    const calculatedScore = activeQuestions.length > 0 ? (correct / activeQuestions.length) * 100 : 0;
    
    const res = { 
      name: studentName, 
      class: studentClass, 
      score: calculatedScore.toFixed(1), 
      correct, 
      wrong: activeQuestions.length - correct,
      date: new Date().toLocaleDateString('id-ID'),
      timestamp: Date.now()
    };
    
    await addDoc(collection(db, "results"), res);
    setScoreData(res);
    setView('result');
  };


  // ==========================================
  // --- TAMPILAN ANTARMUKA (RENDER UI) ---
  // ==========================================

  if (view === 'home') return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl font-bold text-blue-600 tracking-tight">Aplikasi CBT SMK</h1>
      <p className="text-gray-500 mb-4">Sistem Ujian Online Ringan & Cepat</p>
      <div className="flex flex-col space-y-4 w-64">
        <button onClick={prepareStudentLogin} className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition">Masuk Siswa</button>
        <button onClick={() => setView('teacher_login')} className="w-full py-4 bg-gray-600 text-white font-bold rounded-lg shadow-md hover:bg-gray-700 transition">Panel Guru</button>
      </div>
    </div>
  );

  if (view === 'teacher_login') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <form onSubmit={loginTeacher} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Login Guru</h2>
        <input type="password" placeholder="Password (admin123)" value={teacherPass} onChange={(e) => setTeacherPass(e.target.value)} className="w-full border p-3 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none" required />
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold shadow hover:bg-blue-700">Masuk</button>
        <button type="button" onClick={() => setView('home')} className="w-full mt-4 text-gray-500 text-sm hover:underline">Kembali ke Beranda</button>
      </form>
    </div>
  );

  if (view === 'dashboard') return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-4 rounded-xl shadow border-l-4 border-blue-600">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 md:mb-0">Dashboard Guru</h2>
          <button onClick={() => setView('home')} className="px-6 py-2 bg-red-500 text-white rounded font-bold shadow hover:bg-red-600">Logout</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Panel Atur Ujian */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">⚙️ Pengaturan Ujian Aktif</h3>
            <form onSubmit={saveExamConfig} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600">Nama Ujian</label>
                <input type="text" value={examConfig.title} onChange={e => setExamConfig({...examConfig, title: e.target.value})} className="w-full border p-2 rounded mt-1 outline-none focus:border-blue-500" required />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600">Mata Pelajaran</label>
                <input type="text" value={examConfig.subject} onChange={e => setExamConfig({...examConfig, subject: e.target.value})} className="w-full border p-2 rounded mt-1 outline-none focus:border-blue-500" required />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">Durasi (Menit)</label>
                  <input type="number" min="1" value={examConfig.duration} onChange={e => setExamConfig({...examConfig, duration: Number(e.target.value)})} className="w-full border p-2 rounded mt-1" required />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-600">Tampil Soal</label>
                  <input type="number" min="1" value={examConfig.totalQuestions} onChange={e => setExamConfig({...examConfig, totalQuestions: Number(e.target.value)})} className="w-full border p-2 rounded mt-1" required />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 bg-blue-50 p-3 rounded border border-blue-100">
                <input type="checkbox" checked={examConfig.isRandom} onChange={e => setExamConfig({...examConfig, isRandom: e.target.checked})} id="acak" className="w-5 h-5 text-blue-600" />
                <label htmlFor="acak" className="text-sm font-bold text-blue-800 cursor-pointer">Acak Soal Otomatis</label>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold shadow hover:bg-blue-700 transition">Simpan Pengaturan</button>
            </form>
          </div>

          {/* Panel Import Soal */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">📥 Import Bank Soal</h3>
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3 text-sm text-yellow-800">
              <strong>Format Kolom Excel:</strong> No | Soal | A | B | C | D | E | Kunci (A/B/C/D/E) | Link Gambar (Opsional)
            </div>
            <textarea value={rawExcel} onChange={(e) => setRawExcel(e.target.value)} className="w-full border p-3 rounded h-40 mb-3 text-sm font-mono outline-none focus:border-blue-500" placeholder="Paste (Ctrl+V) tabel dari Excel di sini..."></textarea>
            <button onClick={handleImport} className="w-full bg-green-600 text-white p-3 rounded font-bold shadow hover:bg-green-700 transition">Upload Soal ke Database</button>
            <div className="mt-4 text-center p-3 bg-gray-100 rounded">Total Soal Tersimpan: <b className="text-xl text-blue-600">{questions.length}</b></div>
          </div>
        </div>

        {/* Panel Rekap Nilai */}
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-blue-600 flex items-center gap-2">📊 Rekap Nilai Siswa</h3>
            <button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2 rounded font-bold text-sm shadow hover:bg-green-700 w-full md:w-auto flex items-center justify-center gap-2">
              Unduh Excel (CSV)
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <input type="text" placeholder="Cari Nama Siswa..." value={searchName} onChange={e => setSearchName(e.target.value)} className="border p-2 rounded flex-1 outline-none focus:border-blue-500" />
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="border p-2 rounded outline-none w-full md:w-48 focus:border-blue-500">
              <option value="">Semua Kelas</option>
              <option value="XI TKR A">XI TKR A</option>
              <option value="XI TKR B">XI TKR B</option>
              <option value="XI TKR C">XI TKR C</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left border-collapse text-sm md:text-base whitespace-nowrap">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="border-b p-3 font-semibold">Nama Siswa</th>
                  <th className="border-b p-3 font-semibold">Kelas</th>
                  <th className="border-b p-3 font-semibold text-green-600">Benar</th>
                  <th className="border-b p-3 font-semibold text-red-500">Salah</th>
                  <th className="border-b p-3 font-semibold text-blue-600">Nilai Akhir</th>
                  <th className="border-b p-3 font-semibold">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, idx) => (
                  <tr key={idx} className="border-b hover:bg-blue-50 transition">
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.class}</td>
                    <td className="p-3 font-bold text-green-600">{r.correct}</td>
                    <td className="p-3 font-bold text-red-500">{r.wrong}</td>
                    <td className="p-3 font-black text-blue-700 text-lg">{r.score}</td>
                    <td className="p-3 text-gray-500 text-sm">{r.date}</td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr><td colSpan="6" className="text-center p-8 text-gray-500">Belum ada data nilai ujian yang sesuai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === 'student_login') return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <form onSubmit={startExam} className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border-t-8 border-blue-600">
        <h2 className="text-2xl font-bold mb-1 text-center text-gray-800">{examConfig.title}</h2>
        <p className="text-center text-blue-600 font-semibold mb-6">{examConfig.subject} <span className="text-gray-400">|</span> ⏱️ {examConfig.duration} Menit</p>
        
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">Nama Lengkap</label>
          <input type="text" placeholder="Ketik nama Anda..." value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
        </div>
        <div className="mb-8">
          <label className="block text-gray-700 font-bold mb-2">Pilih Kelas</label>
          <select value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            <option value="XI TKR A">XI TKR A</option>
            <option value="XI TKR B">XI TKR B</option>
            <option value="XI TKR C">XI TKR C</option>
          </select>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-lg font-bold text-lg shadow-lg hover:bg-blue-700 transition">Mulai Mengerjakan</button>
        <button type="button" onClick={() => setView('home')} className="w-full mt-4 text-gray-400 text-sm hover:text-gray-600">Kembali ke Awal</button>
      </form>
    </div>
  );

  if (view === 'exam') {
    const q = activeQuestions[currentQ];
    return (
      <div className="min-h-screen bg-gray-100 p-2 md:p-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6">
          
          {/* Bagian Kiri: Area Soal Utama */}
          <div className="flex-1">
            
            {/* Header Info Siswa & Timer */}
            <div className="bg-white p-4 rounded-xl shadow flex justify-between items-center mb-4 border-l-4 border-blue-600">
              <div>
                <p className="font-bold text-gray-800 text-lg">{studentName}</p>
                <p className="text-sm text-gray-500 font-semibold">{studentClass}</p>
              </div>
              <div className={`text-2xl font-black px-4 py-2 rounded-lg border-2 ${timeLeft < 300 ? 'text-red-600 border-red-300 bg-red-50' : 'text-blue-700 border-blue-200 bg-blue-50'}`}>
                {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
              </div>
            </div>

            {/* Kotak Pertanyaan & Pilihan */}
            {q ? (
              <div className="bg-white p-5 md:p-8 rounded-xl shadow mb-4">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h3 className="text-lg font-bold text-gray-700">Pertanyaan No. {currentQ + 1}</h3>
                  <span className="text-sm font-semibold text-gray-400">Dari {activeQuestions.length} Soal</span>
                </div>
                
                {/* Menampilkan Gambar Jika Ada */}
                {q.image && (
                  <div className="mb-6 flex justify-center">
                    <img src={q.image} alt="Ilustrasi Soal" className="max-h-64 object-contain rounded-lg border shadow-sm" />
                  </div>
                )}
                
                <p className="text-gray-800 text-lg mb-8 leading-relaxed whitespace-pre-line">{q.question}</p>
                
                <div className="space-y-3">
                  {['a', 'b', 'c', 'd', 'e'].map((opt) => (
                    <button 
                      key={opt}
                      onClick={() => setAnswers({...answers, [currentQ]: opt.toUpperCase()})}
                      className={`w-full text-left p-4 border-2 rounded-xl transition-all duration-200 ${
                        answers[currentQ] === opt.toUpperCase() 
                        ? 'bg-blue-50 border-blue-500 shadow-sm' 
                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className={`font-bold w-8 h-8 flex items-center justify-center rounded-full mr-3 shrink-0 ${answers[currentQ] === opt.toUpperCase() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {opt.toUpperCase()}
                        </span> 
                        <span className="pt-1 text-gray-700">{q[`option_${opt}`]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl shadow mb-4 text-center font-bold text-gray-500">Memuat soal...</div>
            )}

            {/* Tombol Navigasi Bawah */}
            <div className="flex justify-between items-center mt-6">
              <button disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)} className="px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold shadow disabled:opacity-40 transition hover:bg-gray-600">← Sebelumnya</button>
              
              {currentQ === activeQuestions.length - 1 ? (
                <button onClick={() => { if(window.confirm('Waktu masih tersisa. Yakin ingin mengumpulkan jawaban sekarang?')) submitExam(); }} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow-lg hover:bg-green-700 transition">Selesai & Kumpul</button>
              ) : (
                <button onClick={() => setCurrentQ(currentQ + 1)} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition">Selanjutnya →</button>
              )}
            </div>
          </div>

          {/* Bagian Kanan: Indikator Peta Soal */}
          <div className="w-full lg:w-72 bg-white p-5 rounded-xl shadow h-fit border-t-4 border-gray-300">
            <h4 className="font-bold text-gray-700 mb-4 text-center border-b pb-3">Peta Navigasi Soal</h4>
            <div className="grid grid-cols-5 gap-2">
              {activeQuestions.map((_, i) => {
                const isAnswered = answers[i];
                const isActive = currentQ === i;
                return (
                  <button 
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`w-full aspect-square rounded-lg font-bold flex items-center justify-center transition-all ${
                      isActive ? 'ring-2 ring-blue-600 ring-offset-2 scale-110 ' : ''
                    }${
                      isAnswered 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-8 text-sm font-semibold text-gray-600 space-y-3 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3"><div className="w-5 h-5 bg-blue-600 rounded shadow-sm"></div> Sudah Dijawab</div>
              <div className="flex items-center gap-3"><div className="w-5 h-5 bg-gray-100 border border-gray-300 rounded shadow-sm"></div> Belum Dijawab</div>
            </div>
            <button onClick={() => { if(window.confirm('Yakin ingin mengumpulkan jawaban sekarang?')) submitExam(); }} className="w-full mt-6 py-2 bg-red-100 text-red-600 border border-red-200 font-bold rounded hover:bg-red-200 transition">Akhiri Ujian</button>
          </div>

        </div>
      </div>
    );
  }

  if (view === 'result') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl w-full max-w-lg text-center border-t-8 border-green-500">
        <h2 className="text-3xl font-black text-gray-800 mb-2">Ujian Selesai! 🎉</h2>
        <p className="text-gray-500 font-medium mb-8">Terima kasih telah mengerjakan dengan jujur.</p>
        
        <div className="bg-blue-50 p-6 rounded-xl mb-8 border border-blue-100">
          <p className="text-lg font-bold text-gray-700">{scoreData.name}</p>
          <p className="text-blue-600 font-semibold mb-4">{scoreData.class}</p>
          <p className="text-sm text-gray-500 mb-1">Nilai Akhir Anda</p>
          <div className="text-8xl font-black text-blue-700 tracking-tighter">{scoreData.score}</div>
        </div>
        
        <div className="flex justify-around mb-8 p-4 bg-gray-50 rounded-xl border">
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Benar</p>
            <p className="text-3xl font-black text-green-500">{scoreData.correct}</p>
          </div>
          <div className="w-px bg-gray-300"></div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Salah</p>
            <p className="text-3xl font-black text-red-500">{scoreData.wrong}</p>
          </div>
        </div>
        
        <button onClick={() => setView('home')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition">Kembali ke Halaman Utama</button>
      </div>
    </div>
  );

  return null;
}