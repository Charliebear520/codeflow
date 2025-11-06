import { DownOutlined } from '@ant-design/icons';
import { Row, Col, Select} from "antd"; 
import styles from "./StudentsRecords.module.css";
import StudentsRecordsCard from "../StudentsRecordsCard";

const subjects = [
 { key: '1', label: '未選擇' },
  { key: '2', label: '課程一' },
  { key: '3', label: '課程二' },
];

const StudentsRecords = () => {
    return (
    <div className={styles.container}>
      <div className={styles.DropDownMenu}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* 1. 放置標題的 Col：讓它佔用 3 欄 (1/8 寬) */}
          <Col span={2}> 
            <p className={styles.subjectTitle}>選擇題目:</p>
          </Col>
                    
        {/* 2. 放置 Select 下拉選單的 Col：讓它佔用 6 欄 (1/4 寬) */}
            <Col span={4}> 
                 <Select
                      placeholder="請選擇科目"
                      style={{ width: '100%' }}
                      options={subjects.map(item => ({ value: item.key, label: item.label }))}
                      onChange={(value) => console.log('Selected:', value)}
                  />
            </Col>

           {/* 3. 剩餘的 Col 留空，佔用 24 - 3 - 6 = 15 欄 */}
            <Col span={18} /> 
        </Row>
      </div>

      <div className={styles.StudentsCardContainer}>
          {/* 這裡應使用 map 迴圈渲染，並在 Col 上設定 span={6} 達到四欄佈局 */}
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />

      </div>

    </div>
  );
};

export default StudentsRecords;