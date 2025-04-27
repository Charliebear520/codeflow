import { Steps, Button } from "antd";
import { useNavigate } from "react-router-dom";

const steps = [1, 2, 3];

export default function StageSwitcher({ current, onChange }) {
  const navigate = useNavigate();
  const handleChange = (idx) => {
    onChange && onChange(idx);
    if (idx === 0) navigate("/");
    else if (idx === 1) navigate("/stage2");
    // 你可以根據需求擴充更多階段
  };
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
      <Button
        shape="circle"
        icon="<"
        disabled={current === 0}
        onClick={() => handleChange(current - 1)}
        style={{ marginRight: 16 }}
      />
      <Steps
        current={current}
        size="small"
        style={{ flex: 1 }}
        items={steps.map((num, idx) => ({
          title: "", // 不顯示title
          icon: <span style={{ fontWeight: 700, fontSize: 18 }}>{num}</span>,
          onClick: () => handleChange(idx),
        }))}
        onChange={handleChange}
      />
      <Button
        shape="circle"
        icon=">"
        disabled={current === steps.length - 1}
        onClick={() => handleChange(current + 1)}
        style={{ marginLeft: 16 }}
      />
    </div>
  );
}
