import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

const C = {
  bg: "#F7F5F0", card: "#FFFFFF", primary: "#2D5016", accent: "#7AB648",
  accent2: "#E8F5D8", border: "#D8D0C4", text: "#1A1A1A", muted: "#6B6558",
  danger: "#C0392B", warn: "#92400E", warnBg: "#FFFBEB", warnBorder: "#F59E0B",
  tag: "#EAF4DC", info: "#2B6CB0", infoBg: "#EBF8FF", infoBorder: "#90CDF4",
};

// 핵심 배분 알고리즘
// 각 학급 인원을 체험활동별 정원 비율에 맞춰 배분
// 정원 합계가 전체 학생 수보다 많아야 함
function autoAllocate(classes, activities) {
  // classes: [{name, size}], activities: [{id, name, capacity}]
  const totalCap = activities.reduce((s, a) => s + a.capacity, 0);
  const totalStudents = classes.reduce((s, c) => s + c.size, 0);

  // 결과: alloc[classIdx][actIdx] = 배정 인원
  const alloc = classes.map(cls => activities.map(() => 0));

  // 남은 정원 추적
  const remaining = activities.map(a => a.capacity);

  classes.forEach((cls, ci) => {
    let leftStudents = cls.size;
    const actCount = activities.length;

    // 비율 계산: 각 활동의 정원 / 전체 정원 * 학급인원
    let assigned = activities.map((act, ai) => {
      const ratio = totalCap > 0 ? act.capacity / totalCap : 1 / actCount;
      return Math.floor(cls.size * ratio);
    });

    // 배정 합계와 학급인원 차이 (나머지) 처리
    let sumAssigned = assigned.reduce((s, n) => s + n, 0);
    let diff = cls.size - sumAssigned;

    // 나머지를 소수점 큰 순서대로 배분
    const fractions = activities.map((act, ai) => {
      const ratio = totalCap > 0 ? act.capacity / totalCap : 1 / actCount;
      return { ai, frac: cls.size * ratio - Math.floor(cls.size * ratio) };
    }).sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < diff; i++) {
      assigned[fractions[i % fractions.length].ai]++;
    }

    // 정원 초과 보정
    activities.forEach((act, ai) => {
      if (assigned[ai] > remaining[ai]) assigned[ai] = remaining[ai];
    });

    // 합계가 학급인원보다 적으면 남은 정원 있는 활동에 추가
    let total = assigned.reduce((s, n) => s + n, 0);
    let shortage = cls.size - total;
    for (let ai = 0; ai < actCount && shortage > 0; ai++) {
      const canAdd = Math.min(shortage, remaining[ai] - assigned[ai]);
      if (canAdd > 0) { assigned[ai] += canAdd; shortage -= canAdd; }
    }

    assigned.forEach((n, ai) => {
      alloc[ci][ai] = n;
      remaining[ai] -= n;
    });
  });

  return alloc;
}

function StepBadge({ n, active, done }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%",
      background: done ? C.accent : active ? C.primary : C.border,
      color: done || active ? "#fff" : C.muted,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: "bold", fontSize: 13, flexShrink: 0,
    }}>{done ? "✓" : n}</div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, border: `1.5px solid ${C.border}`,
      padding: "22px 26px", marginBottom: 14,
      boxShadow: "0 2px 10px rgba(0,0,0,0.05)", ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style = {} }) {
  const vs = {
    primary: { background: disabled ? "#ccc" : C.primary, color: "#fff" },
    accent:  { background: disabled ? "#ccc" : C.accent,  color: "#fff" },
    ghost:   { background: "transparent", color: C.primary, border: `1.5px solid ${C.primary}` },
    warn:    { background: disabled ? "#ccc" : C.warn, color: "#fff" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      padding: "10px 20px", borderRadius: 10, border: "none",
      fontFamily: "inherit", fontSize: 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      ...vs[variant], ...style,
    }}>{children}</button>
  );
}

function colLetter(n) {
  let s = "";
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default function App() {
  const [step, setStep] = useState(1);

  // localStorage에서 저장된 설정 불러오기
  function loadSaved(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }

  // 학급: {name, size}
  const [classes, setClasses] = useState(() => loadSaved("kiki_classes", []));
  const [newCls, setNewCls] = useState({ name: "", size: 30 });

  // 체험활동: {id, name, capacity}
  const [activities, setActivities] = useState(() => loadSaved("kiki_activities", []));
  const [newAct, setNewAct] = useState({ name: "", capacity: 30 });

  const [selectedPeriods, setSelectedPeriods] = useState(() => loadSaved("kiki_periods", []));

  // 설정 변경 시 자동 저장
  useEffect(() => { localStorage.setItem("kiki_classes", JSON.stringify(classes)); }, [classes]);
  useEffect(() => { localStorage.setItem("kiki_activities", JSON.stringify(activities)); }, [activities]);
  useEffect(() => { localStorage.setItem("kiki_periods", JSON.stringify(selectedPeriods)); }, [selectedPeriods]);

  // 설정 초기화
  const resetSettings = () => {
    if (!window.confirm("설정을 초기화할까요? 학급, 체험활동, 교시가 모두 기본값으로 돌아가요.")) return;
    const defaultClasses = [];
    const defaultActivities = [];
    const defaultPeriods = [];
    setClasses(defaultClasses);
    setActivities(defaultActivities);
    setSelectedPeriods(defaultPeriods);
    setStep(1);
    localStorage.removeItem("kiki_classes");
    localStorage.removeItem("kiki_activities");
    localStorage.removeItem("kiki_periods");
  };

  // 배분표: alloc[classIdx][actIdx] = 인원 (수동 수정 가능)
  const [alloc, setAlloc] = useState([]);
  const [allocInitialized, setAllocInitialized] = useState(false);

  // 업로드
  const [classData, setClassData] = useState({});
  const [uploadErrors, setUploadErrors] = useState([]);
  const [activityMap, setActivityMap] = useState({});

  // 파생값
  const totalStudents = classes.reduce((s, c) => s + c.size, 0);
  const totalCap = activities.reduce((s, a) => s + a.capacity, 0);
  const actNames = activities.map(a => a.name);

  // 배분표 자동 계산
  const computeAlloc = () => {
    const computed = autoAllocate(classes, activities);
    setAlloc(computed);
    setAllocInitialized(true);
  };

  // 배분표 셀 수동 수정
  const updateAlloc = (ci, ai, val) => {
    const v = Math.max(0, Number(val) || 0);
    setAlloc(prev => prev.map((row, ri) =>
      ri === ci ? row.map((cell, col) => col === ai ? v : cell) : row
    ));
  };

  // 배분표 유효성: 각 활동의 열 합계 ≤ 정원
  const colSums = activities.map((_, ai) =>
    alloc.reduce((s, row) => s + (row[ai] || 0), 0)
  );
  const rowSums = classes.map((_, ci) =>
    alloc[ci] ? alloc[ci].reduce((s, v) => s + v, 0) : 0
  );
  const overflowActs = activities.map((act, ai) => colSums[ai] > act.capacity);
  const underflowRows = classes.map((cls, ci) => rowSums[ci] < cls.size);
  const overflowRows = classes.map((cls, ci) => rowSums[ci] > cls.size);
  const hasError = overflowActs.some(Boolean) || overflowRows.some(Boolean);

  // 서식 다운로드
  // 모든 학급을 시트 하나로 묶어 파일 1개로 다운로드
  const downloadTemplates = () => {
    const wb = XLSX.utils.book_new();

    classes.forEach((cls, ci) => {
      const actCount = activities.length;
      const colsPerAct = 3;
      const gapCols = 1;
      const totalCols = actCount * colsPerAct + (actCount - 1) * gapCols;
      const maxRows = Math.max(...activities.map((_, ai) => alloc[ci] ? alloc[ci][ai] : 10), 10);

      const rows = [];
      const merges = [];

      // 제목 행
      const titleRow = Array(totalCols).fill("");
      titleRow[0] = `[${cls.name}] 체험활동 신청 명단`;
      rows.push(titleRow);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

      // 안내 행
      const guideRow = Array(totalCols).fill("");
      guideRow[0] = "※ 본인 학급 시트에만 입력 / 학번·이름을 해당 체험활동 칸에 입력";
      rows.push(guideRow);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

      // 빈 행
      rows.push(Array(totalCols).fill(""));

      // 체험활동명 헤더
      const actTitleRow = Array(totalCols).fill("");
      activities.forEach((act, ai) => {
        const n = alloc[ci] ? alloc[ci][ai] : 0;
        const sc = ai * (colsPerAct + gapCols);
        actTitleRow[sc] = act.name + "  (최대 " + n + "명)";
        merges.push({ s: { r: 3, c: sc }, e: { r: 3, c: sc + colsPerAct - 1 } });
      });
      rows.push(actTitleRow);

      // 컬럼 헤더
      const headerRow = Array(totalCols).fill("");
      activities.forEach((_, ai) => {
        const sc = ai * (colsPerAct + gapCols);
        headerRow[sc] = "번호";
        headerRow[sc + 1] = "학번";
        headerRow[sc + 2] = "이름";
      });
      rows.push(headerRow);

      // 입력 행
      for (let r = 0; r < maxRows; r++) {
        const dataRow = Array(totalCols).fill("");
        activities.forEach((_, ai) => {
          dataRow[ai * (colsPerAct + gapCols)] = r + 1;
        });
        rows.push(dataRow);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const colWidths = [];
      activities.forEach((_, ai) => {
        colWidths.push({ wch: 5 }, { wch: 10 }, { wch: 10 });
        if (ai < actCount - 1) colWidths.push({ wch: 2 });
      });
      ws["!cols"] = colWidths;
      ws["!merges"] = merges;
      XLSX.utils.book_append_sheet(wb, ws, cls.name.slice(0, 31));
    });

    XLSX.writeFile(wb, "체험활동_신청서식_전체.xlsx");
  };

  // 업로드
  // 파일 1개(시트 여러 개) 또는 파일 여러 개 모두 지원
  // 시트명 = 학급명으로 인식
  const handleFiles = useCallback((files) => {
    const errors = [];
    const newData = {};
    let done = 0;

    function parseSheet(ws, sheetName) {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // ── 새 서식: 체험활동별 열 배치 감지
      // 행3: 체험활동명(최대 N명) 헤더, 행4: 번호|학번|이름 반복
      // 행4에 "번호"+"학번"+"이름"이 여러 세트 있으면 새 서식
      let actHeaderRow = -1;
      let dataHeaderRow = -1;
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].map(c => String(c).trim());
        const idCount = cells.filter(c => c === "학번").length;
        if (idCount >= 1) {
          // 학번이 여러 개 = 새 서식 / 1개 = 구 서식
          if (idCount > 1) {
            actHeaderRow = i - 1;
            dataHeaderRow = i;
          } else {
            // 구 서식: 학번+이름 같은 행
            const hasName = cells.some(c => /^이름$|^성명$/.test(c));
            if (hasName) dataHeaderRow = i;
          }
          break;
        }
      }
      if (dataHeaderRow < 0) return null;

      const students = [];

      if (actHeaderRow >= 0) {
        // ── 새 서식 파싱: 체험활동별 열 그룹
        const actTitleRow = rows[actHeaderRow].map(c => String(c).trim());
        const headerRow   = rows[dataHeaderRow].map(c => String(c).trim());

        // 각 "번호" 열 위치를 기준으로 그룹 분리
        const groups = [];
        headerRow.forEach((h, ci) => {
          if (h === "번호") {
            // 이 열에서 왼쪽으로 체험활동명 찾기
            let actName = "";
            for (let c = ci; c >= 0; c--) {
              if (actTitleRow[c]) { actName = actTitleRow[c].replace(/\s*\(최대.*?\)/, "").trim(); break; }
            }
            const idCol   = ci + 1;
            const nameCol = ci + 2;
            if (actName) groups.push({ actName, idCol, nameCol });
          }
        });

        for (let r = dataHeaderRow + 1; r < rows.length; r++) {
          const row = rows[r];
          groups.forEach(({ actName, idCol, nameCol }) => {
            const sid   = String(row[idCol]   ?? "").trim();
            const sname = String(row[nameCol]  ?? "").trim();
            if (!sid && !sname) return;
            students.push({ id: sid, name: sname, activity: actName });
          });
        }
      } else {
        // ── 구 서식 파싱: 학번|이름|체험활동명 단일 열
        const header  = rows[dataHeaderRow].map(h => String(h).trim());
        const idCol   = header.findIndex(h => /^학번$|^번호$/.test(h));
        const nameCol = header.findIndex(h => /^이름$|^성명$/.test(h));
        const actCol  = header.findIndex(h => /체험|활동/i.test(h));
        if (idCol < 0 || nameCol < 0 || actCol < 0) return null;
        for (let i = dataHeaderRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const sid   = String(row[idCol]   ?? "").trim();
          const sname = String(row[nameCol]  ?? "").trim();
          const sact  = String(row[actCol]   ?? "").trim();
          if (!sid && !sname) continue;
          students.push({ id: sid, name: sname, activity: sact });
        }
      }

      return students;
    }

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const fileName = file.name.replace(/\.[^/.]+$/, "").replace(/_체험활동신청서식$/, "");

          if (wb.SheetNames.length === 1) {
            // 파일 1개 = 학급 1개 (파일명 = 학급명)
            const students = parseSheet(wb.Sheets[wb.SheetNames[0]], fileName);
            if (students) newData[fileName] = students;
            else errors.push(`${file.name}: 학번/이름/체험활동 컬럼을 찾지 못했습니다`);
          } else {
            // 파일 1개에 시트 여러 개 = 각 시트명이 학급명
            wb.SheetNames.forEach(sheetName => {
              const students = parseSheet(wb.Sheets[sheetName], sheetName);
              if (students && students.length > 0) {
                newData[sheetName] = students;
              }
            });
          }
        } catch (err) { errors.push(`${file.name}: ${err.message}`); }
        done++; fin();
      };
      reader.readAsArrayBuffer(file);
      function fin() {
        if (done === files.length) {
          setClassData(prev => ({ ...prev, ...newData }));
          setUploadErrors([...errors]);
        }
      }
    });
  }, []);

  const onDrop = e => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const onDragOver = e => e.preventDefault();

  const buildActivityMap = () => {
    const map = {};
    actNames.forEach(a => { map[a] = []; });
    Object.entries(classData).forEach(([cls, stus]) => {
      stus.forEach(stu => {
        if (!map[stu.activity]) map[stu.activity] = [];
        map[stu.activity].push({ class: cls, id: stu.id, name: stu.name });
      });
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    });
    setActivityMap(map);
    setStep(4);
  };

  const downloadAttendance = () => {
    const wb = XLSX.utils.book_new();
    const periodLabels = selectedPeriods.map(p => `${p}교시`);
    activities.forEach(act => {
      const stus = activityMap[act.name] || [];
      const rows = [
        [`${act.name} 출석부 (정원 ${act.capacity}명)`],
        ["번호", "학급", "학번", "이름", ...periodLabels, "비고"],
        ...stus.map((stu, idx) => [idx + 1, stu.class, stu.id, stu.name, ...Array(periodLabels.length).fill(""), ""]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const totalCols = 4 + periodLabels.length + 1;
      ws["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, ...Array(periodLabels.length).fill({ wch: 8 }), { wch: 14 }];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
      XLSX.utils.book_append_sheet(wb, ws, act.name.slice(0, 31));
    });
    XLSX.writeFile(wb, "체험활동_출석부.xlsx");
  };

  const uploadedClasses = Object.keys(classData);
  const totalUploadedStudents = Object.values(classData).flat().length;
  const unassigned = Object.values(classData).flat().filter(s => s.activity && !actNames.includes(s.activity));
  const overCapActs = activities.filter(act => (activityMap[act.name] || []).length > act.capacity);

  const STEPS = [
    { n: 1, label: "기본 설정" },
    { n: 2, label: "배분표 조정 & 서식 다운로드" },
    { n: 3, label: "명단 업로드" },
    { n: 4, label: "출석부 생성" },
  ];

  const inp = {
    padding: "7px 11px", borderRadius: 8, border: `1.5px solid ${C.border}`,
    background: C.bg, fontSize: 13, fontFamily: "inherit", color: C.text, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif", color: C.text, paddingBottom: 60 }}>
      <div style={{ background: C.primary, color: "#fff", padding: "20px clamp(16px, 5vw, 40px) 18px", borderBottom: `4px solid ${C.accent}` }}>
        <div style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: .7, marginBottom: 4 }}>진로체험 분반 출석부 자동 생성기</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>출석부 생성 마법사 🧙‍♀️</h1>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "22px clamp(16px, 5vw, 40px) 0", boxSizing: "border-box" }}>
        {/* 스텝 바 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          {STEPS.map(({ n, label }, i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, cursor: step > n ? "pointer" : "default" }} onClick={() => step > n && setStep(n)}>
                <StepBadge n={n} active={step === n} done={step > n} />
                <span style={{ fontSize: 11, fontWeight: step === n ? 700 : 400, color: step === n ? C.primary : step > n ? C.accent : C.muted, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 8px", background: step > n ? C.accent : C.border }} />}
            </div>
          ))}
        </div>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (<>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 15, color: C.primary }}>⚙️ 기본 설정</h2>
              <button onClick={resetSettings} style={{
                padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.bg, color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>🔄 초기화</button>
            </div>

            {/* 교시 */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>진행 교시 <span style={{ fontSize: 11 }}>(복수 선택)</span></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_PERIODS.map(p => {
                  const sel = selectedPeriods.includes(p);
                  return (
                    <button key={p} onClick={() => setSelectedPeriods(prev => sel ? prev.filter(x => x !== p) : [...prev, p].sort((a,b)=>a-b))} style={{
                      padding: "7px 16px", borderRadius: 20,
                      border: `2px solid ${sel ? C.primary : C.border}`,
                      background: sel ? C.primary : C.bg, color: sel ? "#fff" : C.muted,
                      fontFamily: "inherit", fontWeight: 600, cursor: "pointer", fontSize: 13,
                    }}>{p}교시</button>
                  );
                })}
              </div>
              {selectedPeriods.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: C.accent, fontWeight: 600 }}>✓ 선택: {selectedPeriods.map(p=>`${p}교시`).join(", ")}</div>}
            </div>

            {/* 학급 목록 + 인원 */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>학급 목록 &amp; 학급 인원</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
                {classes.map((cls, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={cls.name} onChange={e => setClasses(p => p.map((c,j) => j===i ? {...c, name: e.target.value} : c))}
                      style={{ ...inp, flex: 2 }} placeholder="학급명" />
                    <input type="number" value={cls.size} min={1} onChange={e => setClasses(p => p.map((c,j) => j===i ? {...c, size: Number(e.target.value)||0} : c))}
                      style={{ ...inp, width: 70, textAlign: "center" }} />
                    <span style={{ fontSize: 12, color: C.muted }}>명</span>
                    <button onClick={() => setClasses(p => p.filter((_,j) => j!==i))}
                      style={{ padding: "6px 9px", borderRadius: 7, border: "none", background: "#FEE", color: C.danger, cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={newCls.name} onChange={e => setNewCls(p=>({...p,name:e.target.value}))}
                  onKeyDown={e => { if(e.key==="Enter"){ const v=newCls.name.trim(); if(v){setClasses(p=>[...p,{name:v,size:newCls.size}]);setNewCls({name:"",size:30});}}}}
                  placeholder="학급 이름 입력 후 Enter"
                  style={{ ...inp, flex: 2, border: `1.5px dashed ${C.accent}`, background: C.accent2 }} />
                <input type="number" value={newCls.size} min={1} onChange={e => setNewCls(p=>({...p,size:Number(e.target.value)||30}))}
                  style={{ ...inp, width: 70, textAlign: "center" }} />
                <span style={{ fontSize: 12, color: C.muted }}>명</span>
                <Btn variant="accent" onClick={() => { const v=newCls.name.trim(); if(v){setClasses(p=>[...p,{name:v,size:newCls.size}]);setNewCls({name:"",size:30});}}}>+ 추가</Btn>
              </div>
            </div>

            {/* 체험활동 + 정원 */}
            <div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>체험활동 &amp; 전체 정원</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
                {activities.map(act => (
                  <div key={act.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                    <input value={act.name} onChange={e => setActivities(p=>p.map(a=>a.id===act.id?{...a,name:e.target.value}:a))}
                      style={{ ...inp, flex: 2 }} />
                    <input type="number" value={act.capacity} min={0} onChange={e => setActivities(p=>p.map(a=>a.id===act.id?{...a,capacity:Number(e.target.value)||0}:a))}
                      style={{ ...inp, width: 70, textAlign: "center" }} />
                    <span style={{ fontSize: 12, color: C.muted }}>명</span>
                    <button onClick={() => setActivities(p=>p.filter(a=>a.id!==act.id))}
                      style={{ padding: "6px 9px", borderRadius: 7, border: "none", background: "#FEE", color: C.danger, cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.border, flexShrink: 0 }} />
                <input value={newAct.name} onChange={e=>setNewAct(p=>({...p,name:e.target.value}))}
                  onKeyDown={e=>{if(e.key==="Enter"){const v=newAct.name.trim();if(v){setActivities(p=>[...p,{id:Date.now(),name:v,capacity:newAct.capacity}]);setNewAct({name:"",capacity:30});}}}}
                  placeholder="새 체험활동 이름"
                  style={{ ...inp, flex: 2, border: `1.5px dashed ${C.accent}`, background: C.accent2 }} />
                <input type="number" value={newAct.capacity} min={0} onChange={e=>setNewAct(p=>({...p,capacity:Number(e.target.value)||0}))}
                  style={{ ...inp, width: 70, textAlign: "center" }} />
                <span style={{ fontSize: 12, color: C.muted }}>명</span>
                <Btn variant="accent" onClick={()=>{const v=newAct.name.trim();if(v){setActivities(p=>[...p,{id:Date.now(),name:v,capacity:newAct.capacity}]);setNewAct({name:"",capacity:30});}}}>+ 추가</Btn>
              </div>
            </div>
          </Card>

          {/* 요약 + 가능 여부 */}
          <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { emoji: "🏫", label: "학급", value: `${classes.length}개` },
              { emoji: "👥", label: "전체 학생", value: `${totalStudents}명` },
              { emoji: "🎨", label: "체험활동", value: `${activities.length}개` },
              { emoji: "🪑", label: "총 정원", value: `${totalCap}명`, warn: totalCap < totalStudents },
              { emoji: "⏰", label: "교시", value: selectedPeriods.length > 0 ? selectedPeriods.map(p=>`${p}교시`).join("·") : "미선택" },
            ].map(({ emoji, label, value, warn }) => (
              <div key={label} style={{ background: warn ? C.warnBg : C.tag, border: `1px solid ${warn ? C.warnBorder : C.accent}`, borderRadius: 10, padding: "7px 14px", fontSize: 13 }}>
                {emoji} <span style={{ color: C.muted }}>{label}:</span> <strong style={{ color: warn ? C.warn : C.primary }}>{value}</strong>
              </div>
            ))}
          </div>

          {totalCap < totalStudents && (
            <div style={{ background: C.warnBg, border: `1.5px solid ${C.warnBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.warn }}>
              ⚠️ 전체 정원({totalCap}명)이 전체 학생 수({totalStudents}명)보다 적습니다. 정원을 늘려주세요.
            </div>
          )}

          <Btn onClick={() => { computeAlloc(); setStep(2); }}
            disabled={classes.length === 0 || activities.length === 0 || selectedPeriods.length === 0 || totalCap < totalStudents}
            style={{ width: "100%" }}>
            다음: 배분표 확인 & 서식 다운로드 →
          </Btn>
        </>)}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (<>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, color: C.primary }}>📊 학급별 체험활동 배분표</h2>
              <Btn variant="ghost" onClick={computeAlloc} style={{ fontSize: 12, padding: "6px 14px" }}>🔄 자동 재계산</Btn>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>
              각 학급 인원을 체험활동 정원 비율에 맞게 자동 배분했습니다.<br />
              숫자를 직접 수정할 수 있어요. <strong>빨간색</strong> = 정원 초과, <strong>주황색</strong> = 학급인원 미달
            </p>

            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.primary }}>
                    <th style={{ padding: "8px 14px", color: "#fff", textAlign: "left", whiteSpace: "nowrap" }}>학급 / 인원</th>
                    {activities.map(act => (
                      <th key={act.id} style={{ padding: "8px 12px", color: "#fff", textAlign: "center", whiteSpace: "nowrap" }}>
                        {act.name}<br />
                        <span style={{ fontSize: 11, opacity: .8 }}>정원 {act.capacity}명</span>
                      </th>
                    ))}
                    <th style={{ padding: "8px 12px", color: "#fff", textAlign: "center", whiteSpace: "nowrap" }}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls, ci) => {
                    const rowSum = rowSums[ci] || 0;
                    const rowOver = rowSum > cls.size;
                    const rowUnder = rowSum < cls.size;
                    return (
                      <tr key={ci} style={{ background: ci % 2 === 0 ? C.bg : C.card, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{cls.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>총 {cls.size}명</div>
                        </td>
                        {activities.map((act, ai) => {
                          const v = alloc[ci] ? alloc[ci][ai] : 0;
                          const colOver = v > act.capacity;
                          return (
                            <td key={act.id} style={{ padding: "6px 8px", textAlign: "center" }}>
                              <input
                                type="number" value={v} min={0}
                                onChange={e => updateAlloc(ci, ai, e.target.value)}
                                style={{
                                  width: 60, padding: "5px 6px", textAlign: "center", borderRadius: 7,
                                  border: `1.5px solid ${colOver ? C.danger : C.border}`,
                                  background: colOver ? "#FEF2F2" : "#fff",
                                  fontSize: 13, fontFamily: "inherit",
                                  color: colOver ? C.danger : C.text,
                                  fontWeight: 600,
                                }}
                              />
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 12,
                            background: rowOver ? "#FEF2F2" : rowUnder ? C.warnBg : C.accent2,
                            border: `1px solid ${rowOver ? C.danger : rowUnder ? C.warnBorder : C.accent}`,
                            color: rowOver ? C.danger : rowUnder ? C.warn : C.primary,
                            fontWeight: 700, fontSize: 13,
                          }}>
                            {rowSum} / {cls.size}
                            {rowOver ? " 🚨" : rowUnder ? " ⚠️" : " ✓"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* 열 합계 행 */}
                  <tr style={{ background: "#F0F7E8", borderTop: `2px solid ${C.accent}` }}>
                    <td style={{ padding: "8px 14px", fontWeight: 700, fontSize: 13 }}>열 합계 (≤ 정원)</td>
                    {activities.map((act, ai) => {
                      const s = colSums[ai] || 0;
                      const over = s > act.capacity;
                      return (
                        <td key={act.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 12,
                            background: over ? "#FEF2F2" : C.accent2,
                            border: `1px solid ${over ? C.danger : C.accent}`,
                            color: over ? C.danger : C.primary, fontWeight: 700, fontSize: 13,
                          }}>
                            {s} / {act.capacity}{over ? " 🚨" : " ✓"}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 12px", textAlign: "center", fontSize: 12, color: C.muted }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {hasError && (
              <div style={{ background: "#FEF2F2", border: `1.5px solid ${C.danger}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.danger, marginBottom: 8 }}>
                🚨 정원 초과 항목이 있습니다. 수정 후 서식을 다운로드하세요.
              </div>
            )}
            {!hasError && underflowRows.some(Boolean) && (
              <div style={{ background: C.warnBg, border: `1.5px solid ${C.warnBorder}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.warn, marginBottom: 8 }}>
                ⚠️ 일부 학급의 배정 합계가 학급 인원보다 적습니다. 의도된 경우라면 진행해도 됩니다.
              </div>
            )}
            {!hasError && !underflowRows.some(Boolean) && (
              <div style={{ background: C.accent2, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.primary, marginBottom: 8 }}>
                ✅ 배분표가 올바릅니다. 서식을 다운로드하세요.
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, color: C.primary }}>📥 학급별 서식 다운로드</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.muted }}>
              각 학급 서식에 해당 학급의 배정 인원이 포함됩니다.
            </p>
            <Btn variant="accent" onClick={downloadTemplates} disabled={hasError} style={{ width: "100%", fontSize: 14, padding: "13px" }}>
              📥 전체 서식 다운로드 (학급별 시트, 파일 1개)
            </Btn>
          </Card>

          <Card style={{ background: C.warnBg, border: `1.5px solid ${C.warnBorder}` }}>
            <div style={{ fontSize: 13, color: C.warn, lineHeight: 1.9 }}>
              <strong>📌 담임선생님 배포 시 안내</strong><br />
              • 시트 이름(탭) 변경 금지 — 시트명이 학급명으로 자동 인식<br />
              • 반드시 본인 학급 시트에만 입력 (다른 반 시트 수정 금지)<br />
              • A열: 학번 / B열: 이름 / C열: 체험활동명 순으로 입력<br />
              • 체험활동명은 서식에 적힌 이름 그대로 입력 (오탈자 주의)
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>← 설정 수정</Btn>
            <Btn onClick={() => setStep(3)} style={{ flex: 1 }}>명단 수합 후 업로드 →</Btn>
          </div>
        </>)}

        {/* ══ STEP 3 ══ */}
        {step === 3 && (<>
          <Card>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, color: C.primary }}>📂 작성된 명단 업로드</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.muted }}>담임선생님들이 입력한 파일을 업로드하세요. 학급별 파일 여러 개도, 시트 여러 개짜리 파일 1개도 모두 됩니다.</p>

            <div onDrop={onDrop} onDragOver={onDragOver} onClick={() => document.getElementById("fileInput").click()}
              style={{ border: `2px dashed ${C.accent}`, borderRadius: 14, padding: "28px 24px", textAlign: "center", background: C.accent2, cursor: "pointer", marginBottom: 14 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>📁</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>드래그하거나 클릭해서 파일 선택</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>파일 1개(시트 여러 개) 또는 학급별 파일 여러 개 모두 지원</div>
              <input id="fileInput" type="file" accept=".xlsx,.xls" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
            </div>

            {uploadedClasses.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>업로드 현황 ({uploadedClasses.length}/{classes.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {classes.map(cls => {
                    const ok = uploadedClasses.includes(cls.name);
                    return (
                      <div key={cls.name} style={{ display: "flex", alignItems: "center", gap: 5, background: ok ? C.tag : "#F5F5F5", border: `1px solid ${ok ? C.accent : C.border}`, borderRadius: 20, padding: "4px 11px", fontSize: 12 }}>
                        <span>{ok ? "✅" : "⬜"}</span>
                        <span style={{ color: ok ? C.primary : C.muted, fontWeight: ok ? 600 : 400 }}>{cls.name}</span>
                        {ok && <span style={{ color: C.muted }}>({classData[cls.name]?.length}명)</span>}
                      </div>
                    );
                  })}
                  {uploadedClasses.filter(c => !classes.map(x=>x.name).includes(c)).map(c => (
                    <div key={c} style={{ display: "flex", alignItems: "center", gap: 5, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 20, padding: "4px 11px", fontSize: 12 }}>
                      ⚠️ <span style={{ color: C.warn }}>{c} (설정 외 학급)</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {uploadErrors.length > 0 && (
              <div style={{ background: "#FEF2F2", border: `1px solid ${C.danger}`, borderRadius: 9, padding: "10px 14px", marginBottom: 10 }}>
                {uploadErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: C.danger }}>⚠️ {e}</div>)}
              </div>
            )}
            {unassigned.length > 0 && (
              <div style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 9, padding: "10px 14px", fontSize: 12, color: C.warn }}>
                ⚠️ <strong>{unassigned.length}명</strong>의 체험활동명 불일치: {[...new Set(unassigned.map(s => `"${s.activity}"`))].join(", ")}
              </div>
            )}
          </Card>

          {totalUploadedStudents > 0 && (
            <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { label: "업로드 학급", value: `${uploadedClasses.length}개` },
                { label: "총 학생", value: `${totalUploadedStudents}명` },
                { label: "이름 불일치", value: `${unassigned.length}명`, warn: unassigned.length > 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} style={{ background: warn ? C.warnBg : C.tag, border: `1px solid ${warn ? C.warnBorder : C.accent}`, borderRadius: 10, padding: "7px 14px", fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{label}: </span>
                  <strong style={{ color: warn ? C.warn : C.primary }}>{value}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setStep(2)}>← 이전</Btn>
            <Btn onClick={buildActivityMap} disabled={uploadedClasses.length === 0} style={{ flex: 1 }}>출석부 생성 →</Btn>
          </div>
        </>)}

        {/* ══ STEP 4 ══ */}
        {step === 4 && (<>
          <Card>
            <h2 style={{ margin: "0 0 6px", fontSize: 15, color: C.primary }}>✅ 체험활동별 출석부</h2>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: C.muted }}>
              총 {totalUploadedStudents}명 · {activities.length}개 활동 · {selectedPeriods.map(p=>`${p}교시`).join("·")} 출석 체크
            </p>

            {overCapActs.length > 0 && (
              <div style={{ background: "#FEF2F2", border: `1.5px solid ${C.danger}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.danger }}>
                🚨 정원 초과: {overCapActs.map(act=>`${act.name} (정원 ${act.capacity}명 / 신청 ${(activityMap[act.name]||[]).length}명)`).join(", ")}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {activities.map(act => {
                const cnt = (activityMap[act.name] || []).length;
                const over = cnt > act.capacity;
                const pct = Math.min(cnt / act.capacity * 100, 100);
                return (
                  <div key={act.id} style={{ background: over ? "#FEF2F2" : C.tag, border: `1.5px solid ${over ? C.danger : C.accent}`, borderRadius: 10, padding: "8px 14px", minWidth: 130 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: over ? C.danger : C.primary, marginBottom: 4 }}>{act.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{cnt}명 / {act.capacity}명 {over ? "🚨" : ""}</div>
                    <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: over ? C.danger : C.accent }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {activities.map(act => {
              const stus = activityMap[act.name] || [];
              const over = stus.length > act.capacity;
              return (
                <div key={act.id} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <h3 style={{ margin: 0, fontSize: 13, color: over ? C.danger : C.primary }}>🎨 {act.name}</h3>
                    <span style={{ background: over?"#FEE":C.tag, border:`1px solid ${over?C.danger:C.accent}`, borderRadius:20, padding:"1px 9px", fontSize:12, color:over?C.danger:C.muted }}>
                      {stus.length}명 / {act.capacity}명 {over?"🚨 초과":""}
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: over ? C.danger : C.primary }}>
                          {["번호","학급","학번","이름",...selectedPeriods.map(p=>`${p}교시`),"비고"].map(h=>(
                            <th key={h} style={{ padding:"5px 7px", color:"#fff", textAlign:"center", whiteSpace:"nowrap", fontWeight:600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stus.length === 0
                          ? <tr><td colSpan={4+selectedPeriods.length+1} style={{ textAlign:"center", padding:12, color:C.muted }}>배정된 학생 없음</td></tr>
                          : stus.map((stu, idx) => (
                            <tr key={idx} style={{ background:idx%2===0?C.bg:C.card, borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:"4px 7px", textAlign:"center", color:C.muted }}>{idx+1}</td>
                              <td style={{ padding:"4px 7px", textAlign:"center" }}>{stu.class}</td>
                              <td style={{ padding:"4px 7px", textAlign:"center" }}>{stu.id}</td>
                              <td style={{ padding:"4px 7px", fontWeight:600 }}>{stu.name}</td>
                              {selectedPeriods.map((_,p)=>(
                                <td key={p} style={{ padding:"4px 7px", textAlign:"center", color:C.border, fontSize:15 }}>□</td>
                              ))}
                              <td style={{ padding:"4px 7px" }}></td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setStep(3)}>← 다시 업로드</Btn>
            <Btn variant="accent" onClick={downloadAttendance} style={{ flex: 1, fontSize: 14, padding: "12px" }}>
              📥 출석부 엑셀 다운로드 (.xlsx)
            </Btn>
          </div>
        </>)}
      </div>

      {/* 푸터 */}
      <div style={{ textAlign: "center", padding: "32px 0 16px", fontSize: 12, color: C.muted, opacity: .6 }}>
        Made by <a href="mailto:kkongmu@naver.com" style={{ color: C.muted, textDecoration: "none" }}>키키쌤 🧙‍♀️</a>
      </div>
    </div>
  );
}
