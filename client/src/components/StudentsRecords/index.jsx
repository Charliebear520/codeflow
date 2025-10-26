import { DownOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Row, Col, Select, App, Spin, Empty } from "antd";
import styles from "./StudentsRecords.module.css";
import StudentsRecordsCard from "../StudentsRecordsCard";

const subjects = [
  { key: 'all', label: '全部' },
  { key: 'Q001', label: '示範題 Q001' },
];



const StudentsRecords = () => {
  const { message } = App.useApp();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subs, setSubs] = useState([]); // 從後端抓回的 Submission 陣列
  const [questionId, setQuestionId] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const qs =
          questionId && questionId !== "all"
            ? `?questionId=${encodeURIComponent(questionId)}`
            : "";
        const res = await fetch(`/api/admin/submissions${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "讀取失敗");
        setSubs(data.items || []);
      } catch (e) {
        console.error(e);
        message.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, questionId, message]);
  // 依學生分組（每位學生一張卡片）
  const cards = useMemo(() => {
    const map = new Map(); // key: student._id
    for (const s of subs) {
      const stu = s.student || {};
      if (!map.has(stu._id)) {
        map.set(stu._id, {
          student: stu,
          submissions: [],
        });
      }
      map.get(stu._id).submissions.push(s);
    }

    // 若每生每題要顯示多張，這裡可以再展開；先做「每生一張、取最新一筆」
    const arr = [];
    for (const { student, submissions } of map.values()) {
      const latest = submissions.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      arr.push({ student, submission: latest });
    }
    return arr;
  }, [subs]);

  return (
    <div className={styles.container}>
      <div className={styles.DropDownMenu}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={2}>
            <p className={styles.subjectTitle}>選擇題目:</p>
          </Col>
          <Col span={4}>
            <Select
              style={{ width: "100%" }}
              options={subjects.map((i) => ({ value: i.key, label: i.label }))}
              value={questionId}
              onChange={setQuestionId}
            />
          </Col>
          <Col span={18} />
        </Row>
      </div>

      {loading ? (
        <Spin />
      ) : cards.length === 0 ? (
        <Empty description="沒有資料" />
      ) : (
        <Row gutter={[16, 16]}>
          {cards.map(({ student, submission }, index) => (
            <Col span={6} key={index}>
              <StudentsRecordsCard
                student={student}
                submission={submission}
              />
            </Col>
          ))}
          {cards.map(({ student, submission }, index) => (
            <Col span={6} key={index}>
              <StudentsRecordsCard
                student={student}
                submission={submission}
              />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default StudentsRecords;