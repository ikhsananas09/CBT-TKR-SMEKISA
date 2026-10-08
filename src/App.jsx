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
    setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
          question: cols[1], 
          option_a: cols[2], 
          option_b: cols[3], 
          option_c: cols[4], 
          option_d: cols[5], 
          option_e: cols[6], 
          answer_key: cols[7]?.trim().toUpperCase(),
          image: cols[8]?.trim() || '' 
        });
        count++;
      }
    }
    setRawExcel('');
    alert(`${count} Soal berhasil diimport ke database!`);
    fetchQuestions();
  };

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

    // Logika Paket Acak/Tetap
    if (examConfig.isRandom) {
      allQ = allQ.sort(() => 0.5 - Math.random()); 
    }
    
    // Batasi jumlah soal sesuai pengaturan guru
    const finalQ = allQ.slice(0, examConfig.totalQuestions);
    
    if (finalQ.length === 0) return alert('Belum ada soal di database!');

    setActiveQuestions(finalQ);
    setTimeLeft(examConfig.duration * 60);
    setAnswers({});
    setCurrentQ(0);
    setView('exam');
  };

  useEffect(() => {
    if (view === 'exam' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (view === 'exam' && timeLeft === 0) {
      submitExam();
    }
  }, [view, timeLeft]);

  const submitExam = async () => {
    let correct = 0;
    activeQuestions.forEach((q, i) => { 
      if (answers[i] === q.answer_key) correct++; 
    });
    const score = activeQuestions.length > 0 ? (correct / activeQuestions.length) * 100 : 0;
    const res = { 
      name: studentName, 
      class: studentClass, 
      score: score.toFixed(1), 
      correct, 
      wrong: activeQuestions.length - correct,
      date: new Date().toLocaleDateString('id-ID')
    };
    await addDoc(collection(db, "results"), res);
    setScoreData(res);
    setView('result');
  };

  // Filter Hasil
  const filteredResults = results.filter(r => 
    r.name.toLowerCase().includes(searchName.toLowerCase()) &&
    (filterClass === '' || r.class === filterClass)
  );

  // --- Tampilan Render ---
  if (view === 'home') return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl font-bold text-blue-600">Aplikasi CBT SMK</h1>
      <div className="flex flex-col space-y-4">
        <button onClick={prepareStudentLogin} className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700">Masuk sebagai Siswa</button>
        <button onClick={() => setView('teacher_login')} className="px-8 py-4 bg-gray-600 text-white font-bold rounded-lg shadow hover:bg-gray-700">Masuk sebagai Guru</button>
      </div>
    </div>
  );

  if (view === 'teacher_login') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <form onSubmit={loginTeacher} className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Login Guru</h2>
        <input type="password" placeholder="Masukkan Password (admin123)" value={teacherPass} onChange={(e) => setTeacherPass(e.target.value)} className="w-full border p-3 rounded mb-4 focus:outline-none focus:border-blue-500" required />
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">Login</button>
        <button type="button" onClick={() => setView('home')} className="w-full mt-2 text-gray-500 underline">Kembali</button>
      </form>
    </div>
  );

  if (view === 'dashboard') return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded shadow">
          <h2 className="text-2xl font-bold text-gray-800">Dashboard Guru</h2>
          <button onClick={() => setView('home')} className="px-4 py-2 bg-red-500 text-white rounded">Logout</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Panel Pembuatan Ujian */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4 text-blue-600">Buat / Atur Ujian Aktif</h3>
            <form onSubmit={saveExamConfig} className="space-y-3">
              <div><label className="text-sm font-bold text-gray-600">Nama Ujian</label><input type="text" value={examConfig.title} onChange={e => setExamConfig({...examConfig, title: e.target.value})} className="w-full border p-2 rounded" /></div>
              <div><label className="text-sm font-bold text-gray-600">Mata Pelajaran</label><input type="text" value={examConfig.subject} onChange={e => setExamConfig({...examConfig, subject: e.target.value})} className="w-full border p-2 rounded" /></div>
              <div className="flex gap-4">
                <div className="flex-1"><label className="text-sm font-bold text-gray-600">Durasi (Menit)</label><input type="number" value={examConfig.duration} onChange={e => setExamConfig({...examConfig, duration: Number(e.target.value)})} className="w-full border p-2 rounded" /></div>
                <div className="flex-1"><label className="text-sm font-bold text-gray-600">Jumlah Tampil</label><input type="number" value={examConfig.totalQuestions} onChange={e => setExamConfig({...examConfig, totalQuestions: Number(e.target.value)})} className="w-full border p-2 rounded" /></div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={examConfig.isRandom} onChange={e => setExamConfig({...examConfig, isRandom: e.target.checked})} id="acak" />
                <label htmlFor="acak" className="text-sm font-bold text-gray-600">Acak Otomatis (Pertanyaan & Pilihan)</label>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold mt-2 hover:bg-green-700">Simpan Pengaturan Ujian</button>
            </form>
          </div>

          {/* Panel Import Soal */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4 text-blue-600">Import Soal dari Excel</h3>
            <p className="text-sm text-gray-500 mb-2">Copy tabel (Kolom: No, Soal, A, B, C, D, E, Kunci, Link Gambar Opsional):</p>
            <textarea value={rawExcel} onChange={(e) => setRawExcel(e.target.value)} className="w-full border p-2 rounded h-32 mb-4 text-sm" placeholder="Paste data Excel di sini..."></textarea>
            <button onClick={handleImport} className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Import ke Database</button>
            <p className="mt-4 text-gray-700">Total Bank Soal Tersimpan: <b>{questions.length}</b></p>
          </div>
        </div>

        {/* Panel Rekap Nilai */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-blue-600">Rekap Nilai Siswa</h3>
            <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-green-700">Export Excel / CSV</button>
          </div>
          
          <div className="flex gap-4 mb-4">
            <input type="text" placeholder="Cari Nama Siswa..." value={searchName} onChange={e => setSearchName(e.target.value)} className="border p-2 rounded flex-1" />
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="border p-2 rounded">
              <option value="">Semua Kelas</option>
              <option value="XI TKR A">XI TKR A</option>
              <option value="XI TKR B">XI TKR B</option>
              <option value="XI TKR C">XI TKR C</option>
            </select>
          </div>

          <div className="overflow-auto max-h-96">
            <table className="w-full text-left border-collapse text-sm md:text-base">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Nama</th>
                  <th className="border p-2">Kelas</th>
                  <th className="border p-2">Benar</th>
                  <th className="border p-2">Salah</th>
                  <th className="border p-2">Nilai Akhir</th>
                  <th className="border p-2">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="border p-2">{r.name}</td>
                    <td className="border p-2">{r.class}</td>
                    <td className="border p-2 text-green-600 font-bold">{r.correct}</td>
                    <td className="border p-2 text-red-500 font-bold">{r.wrong}</td>
                    <td className="border p-2 font-black text-blue-600">{r.score}</td>
                    <td className="border p-2 text-gray-500">{r.date}</td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr><td colSpan="6" className="text-center p-4 text-gray-500">Belum ada data ujian.</td></tr>
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
      <form onSubmit={startExam} className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-blue-600">{examConfig.title}</h2>
        <p className="text-center text-gray-500 mb-6">{examConfig.subject} - Durasi: {examConfig.duration} Menit</p>
        
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">Nama Lengkap</label>
          <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full border p-3 rounded focus:border-blue-500 outline-none" required />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Pilih Kelas</label>
          <select value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className="w-full border p-3 rounded focus:border-blue-500 outline-none">
            <option value="XI TKR A">XI TKR A</option>
            <option value="XI TKR B">XI TKR B</option>
            <option value="XI TKR C">XI TKR C</option>
          </select>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">Mulai Ujian</button>
        <button type="button" onClick={() => setView('home')} className="w-full mt-3 text-gray-500 underline text-sm">Kembali ke Beranda</button>
      </form>
    </div>
  );

  if (view === 'exam') {
    const q = activeQuestions[currentQ];
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
          
          {/* Bagian Kiri: Area Soal */}
          <div className="flex-1">
            <div className="bg-white p-4 rounded shadow flex justify-between items-center mb-4">
              <div>
                <p className="font-bold text-gray-800">{studentName}</p>
                <p className="text-sm text-gray-500">{studentClass}</p>
              </div>
              <div className="text-2xl font-black text-red-600 border-2 border-red-200 bg-red-50 px-4 py-1 rounded">
                {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
              </div>
            </div>

            {q ? (
              <div className="bg-white p-6 rounded shadow mb-4">
                <h3 className="text-lg font-bold mb-4 border-b pb-2">Soal No. {currentQ + 1}</h3>
                
                {/* Fitur Soal Bergambar */}
                {q.image && (
                  <img src={q.image} alt="Soal" className="mb-4 max-h-64 object-contain mx-auto rounded border" />
                )}
                
                <p className="text-gray-800 text-lg mb-6 whitespace-pre-line">{q.question}</p>
                
                <div className="space-y-3">
                  {['a', 'b', 'c', 'd', 'e'].map((opt) => (
                    <button 
                      key={opt}
                      onClick={() => setAnswers({...answers, [currentQ]: opt.toUpperCase()})}
                      className={`w-full text-left p-3 border rounded transition-colors ${answers[currentQ] === opt.toUpperCase() ? 'bg-blue-100 border-blue-500 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      <span className="font-bold uppercase mr-3">{opt}.</span> {q[`option_${opt}`]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded shadow mb-4 text-center">Menyiapkan soal...</div>
            )}

            {/* Navigasi Bawah */}
            <div className="flex justify-between mt-4">
              <button disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)} className="px-6 py-2 bg-gray-500 text-white rounded disabled:opacity-50">Sebelumnya</button>
              {currentQ === activeQuestions.length - 1 ? (
                <button onClick={() => { if(window.confirm('Yakin ingin mengumpulkan ujian?')) submitExam(); }} className="px-6 py-2 bg-green-600 text-white rounded font-bold shadow hover:bg-green-700">Selesai & Kumpulkan</button>
              ) : (
                <button onClick={() => setCurrentQ(currentQ + 1)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700">Selanjutnya</button>
              )}
            </div>
          </div>

          {/* Bagian Kanan: Indikator Nomor Soal */}
          <div className="w-full md:w-64 bg-white p-4 rounded shadow h-fit">
            <h4 className="font-bold text-gray-700 mb-4 text-center border-b pb-2">Navigasi Soal</h4>
            <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
              {activeQuestions.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className={`w-10 h-10 rounded font-bold flex items-center justify-center border transition-all ${
                    currentQ === i ? 'ring-2 ring-blue-500 ring-offset-1 ' : ''
                  }${
                    answers[i] ? 'bg-green-500 text-white border-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-6 text-sm text-gray-500 space-y-2">
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div> Sudah Dijawab</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border rounded"></div> Belum Dijawab</div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (view === 'result') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <h2 className="text-3xl font-bold text-blue-600 mb-2">Ujian Selesai!</h2>
        <p className="text-gray-600 mb-6">{scoreData.name} - {scoreData.class}</p>
        
        <div className="text-7xl font-black text-gray-800 mb-6">{scoreData.score}</div>
        
        <div className="flex justify-around mb-8 border-t border-b py-4">
          <div>
            <p className="text-sm text-gray-500">Jawaban Benar</p>
            <p className="text-2xl font-bold text-green-500">{scoreData.correct}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Jawaban Salah</p>
            <p className="text-2xl font-bold text-red-500">{scoreData.wrong}</p>
          </div>
        </div>
        
        <button onClick={() => setView('home')} className="w-full bg-blue-600 text-white p-3 rounded font-bold shadow hover:bg-blue-700">Kembali ke Awal</button>
      </div>
    </div>
  );

  return null;
}