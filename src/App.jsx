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
          image: cols[8]?.trim() || '' // Opsional kolom ke-9 untuk link gambar
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
      allQ = allQ.sort(() => 0.5 - Math.random()); // Acak soal
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
            <h3 className="text-xl font-bold mb-4 text-blue