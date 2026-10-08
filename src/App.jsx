import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const [view, setView] = useState('home');
  
  // State Guru
  const [teacherPass, setTeacherPass] = useState('');
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [rawExcel, setRawExcel] = useState('');

  // State Siswa
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('XI TKR A');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 Menit (dalam detik)
  const [scoreData, setScoreData] = useState(null);

  // --- Fungsi Database ---
  const fetchQuestions = async () => {
    const snap = await getDocs(collection(db, "questions"));
    setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchResults = async () => {
    const snap = await getDocs(collection(db, "results"));
    setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // --- Logika Guru ---
  const loginTeacher = (e) => {
    e.preventDefault();
    // Password default guru: admin123
    if (teacherPass === 'admin123') { 
      setView('dashboard'); 
      fetchQuestions(); 
      fetchResults(); 
    } else {
      alert('Password salah!');
    }
  };

  const handleImport = async () => {
    if (!rawExcel) return alert('Data kosong!');
    const rows = rawExcel.split('\n');
    let count = 0;
    for (let row of rows) {
      const cols = row.split('\t'); // Pemisah copy-paste Excel
      if (cols.length >= 7) {
        await addDoc(collection(db, "questions"), {
          question: cols[1], 
          option_a: cols[2], 
          option_b: cols[3], 
          option_c: cols[4], 
          option_d: cols[5], 
          option_e: cols[6], 
          answer_key: cols[7]?.trim().toUpperCase()
        });
        count++;
      }
    }
    setRawExcel('');
    alert(`${count} Soal berhasil diimport ke database!`);
    fetchQuestions();
  };

  // --- Logika Siswa ---
  const startExam = async (e) => {
    e.preventDefault();
    if (!studentName) return alert('Nama harus diisi!');
    await fetchQuestions();
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
    questions.forEach((q, i) => { 
      if (answers[i] === q.answer_key) correct++; 
    });
    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const res = { 
      name: studentName, 
      class: studentClass, 
      score: score.toFixed(1), 
      correct, 
      wrong: questions.length - correct,
      date: new Date().toLocaleDateString('id-ID')
    };
    await addDoc(collection(db, "results"), res);
    setScoreData(res);
    setView('result');
  };

  // --- Tampilan Render ---
  
  if (view === 'home') return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl font-bold text-blue-600">Aplikasi CBT Ujian</h1>
      <div className="flex flex-col space-y-4">
        <button onClick={() => setView('student_login')} className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700">Masuk sebagai Siswa</button>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Panel Import Soal */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4 text-blue-600">Import Soal dari Excel</h3>
            <p className="text-sm text-gray-500 mb-2">Copy tabel dari Excel (Kolom: No, Soal, A, B, C, D, E, Kunci) dan Paste ke kotak di bawah ini:</p>
            <textarea value={rawExcel} onChange={(e) => setRawExcel(e.target.value)} className="w-full border p-2 rounded h-32 mb-4" placeholder="Paste data Excel di sini..."></textarea>
            <button onClick={handleImport} className="w-full bg-blue-600 text-white p-2 rounded font-bold">Import ke Database</button>
            <p className="mt-4 text-gray-700">Total Bank Soal: <b>{questions.length}</b></p>
          </div>

          {/* Panel Rekap Nilai */}
          <div className="bg-white p-6 rounded-lg shadow overflow-auto h-96">
            <h3 className="text-xl font-bold mb-4 text-blue-600">Rekap Nilai Siswa</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Nama</th>
                  <th className="border p-2">Kelas</th>
                  <th className="border p-2">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="border p-2">{r.name}</td>
                    <td className="border p-2">{r.class}</td>
                    <td className="border p-2 font-bold text-blue-600">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === 'student_login') return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <form onSubmit={startExam} className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Ulangan Harian Sistem Starter</h2>
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">Nama Lengkap</label>
          <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full border p-3 rounded focus:border-blue-500 outline-none" required />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Kelas</label>
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
    const q = questions[currentQ];
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header Ujian */}
          <div className="bg-white p-4 rounded shadow flex justify-between items-center mb-4">
            <div>
              <p className="font-bold text-gray-800">{studentName} - {studentClass}</p>
            </div>
            <div className="text-xl font-bold text-red-500 border border-red-500 px-4 py-1 rounded">
              {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
            </div>
          </div>

          {/* Kotak Soal */}
          {q ? (
            <div className="bg-white p-6 rounded shadow mb-4">
              <h3 className="text-lg font-bold mb-4">Soal {currentQ + 1} dari {questions.length}</h3>
              <p className="text-gray-800 text-lg mb-6">{q.question}</p>
              <div className="space-y-3">
                {['a', 'b', 'c', 'd', 'e'].map((opt) => (
                  <button 
                    key={opt}
                    onClick={() => setAnswers({...answers, [currentQ]: opt.toUpperCase()})}
                    className={`w-full text-left p-3 border rounded ${answers[currentQ] === opt.toUpperCase() ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}`}
                  >
                    <span className="font-bold uppercase mr-3">{opt}.</span> {q[`option_${opt}`]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded shadow mb-4 text-center">Belum ada soal di database.</div>
          )}

          {/* Navigasi Bawah */}
          <div className="flex justify-between mt-6">
            <button disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)} className="px-6 py-2 bg-gray-500 text-white rounded disabled:opacity-50">Sebelumnya</button>
            {currentQ === questions.length - 1 ? (
              <button onClick={submitExam} className="px-6 py-2 bg-green-500 text-white rounded font-bold">Selesai & Kumpulkan</button>
            ) : (
              <button onClick={() => setCurrentQ(currentQ + 1)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Selanjutnya</button>
            )}
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
        
        <div className="text-6xl font-black text-gray-800 mb-6">{scoreData.score}</div>
        
        <div className="flex justify-around mb-8 border-t border-b py-4">
          <div>
            <p className="text-sm text-gray-500">Benar</p>
            <p className="text-xl font-bold text-green-500">{scoreData.correct}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Salah</p>
            <p className="text-xl font-bold text-red-500">{scoreData.wrong}</p>
          </div>
        </div>
        
        <button onClick={() => setView('home')} className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">Kembali ke Awal</button>
      </div>
    </div>
  );

  return null;
}