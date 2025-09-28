import { Row} from "antd"; 
import styles from "./StudentsRecords.module.css";
import StudentsRecordsCard from "../StudentsRecordsCard";
const StudentsRecords = () => {
    return (
    <div className={styles.container}>
      <Row span={4} >
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
        <StudentsRecordsCard />
      </Row>
    </div>
  );
};

export default StudentsRecords;