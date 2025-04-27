import React, { useState } from "react";
import { Button, message } from "antd";

// props: template(陣列), answers(陣列)
const PseudoCodeFillBlank = ({ template, answers }) => {
  // 學生填空的內容
  const [inputs, setInputs] = useState(Array(answers.length).fill(""));
  const [checked, setChecked] = useState(false);

  // 處理填空輸入
  const handleInputChange = (idx, val) => {
    const newInputs = [...inputs];
    newInputs[idx] = val;
    setInputs(newInputs);
  };

  // 檢查答案
  const handleCheck = () => {
    setChecked(true);
    const isCorrect = inputs.every((val, idx) => val.trim() === answers[idx]);
    if (isCorrect) {
      message.success("全部正確！");
    } else {
      message.error("有錯誤，請再檢查！");
    }
  };

  // 將模板渲染成可填空的行
  let blankIndex = 0;
  const renderLine = (line, lineIdx) => {
    const parts = line.split("___");
    return (
      <div
        key={lineIdx}
        style={{ marginBottom: 8, fontFamily: "monospace", fontSize: 16 }}
      >
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < parts.length - 1 && (
              <input
                style={{
                  width: 40,
                  border:
                    checked && inputs[blankIndex] !== answers[blankIndex]
                      ? "2px solid red"
                      : "1px solid #ccc",
                  margin: "0 4px",
                }}
                value={inputs[blankIndex]}
                onChange={(e) => handleInputChange(blankIndex, e.target.value)}
                disabled={checked && inputs[blankIndex] === answers[blankIndex]}
              />
            )}
            {idx < parts.length - 1 && blankIndex++}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // 重置
  const handleReset = () => {
    setInputs(Array(answers.length).fill(""));
    setChecked(false);
  };

  return (
    <div>
      <div style={{ fontFamily: "monospace", fontSize: 16, marginBottom: 16 }}>
        {template.map((line, idx) => renderLine(line, idx))}
      </div>
      <Button type="primary" onClick={handleCheck} style={{ marginRight: 8 }}>
        檢查
      </Button>
      <Button onClick={handleReset}>重置</Button>
    </div>
  );
};

export default PseudoCodeFillBlank;
