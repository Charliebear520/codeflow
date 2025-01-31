import React, { useRef, useState } from 'react';
import { ConfigProvider, Tabs, Button } from 'antd';
import ReactFlowDnd from '../ReactFlowDnd';
import Upload from '../upload';
import styles from './answer.module.css';
import { IKImage } from 'imagekitio-react';

// 定义初始节点和边
const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'input node' },
    position: { x: 250, y: 5 },
  },
];

const initialEdges = []; // 初始边为空



const Answer = () => {
  const resetFlowRef = useRef(null);

  const handleReset = () => {
    if (resetFlowRef.current) {
      resetFlowRef.current();
    } else {
      console.error('resetFlow is not set');
    }
  };
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
  })
  const items = [
    {
      key: '1',
      label: '上傳流程圖',
      children: (

        <div style={{ height: '100%' }}>
          <Upload img={img} setImg={setImg} />
        </div>
      ),
    },
    {
      key: '2',
      label: '線上製作',
      children: (
        <div style={{ height: '100%' }}>
          <ReactFlowDnd
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onReset={(resetFlow) => (resetFlowRef.current = resetFlow)}
          />
        </div>
      ),
    },
  ];

  const extraButtons = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button type="primary">檢查</Button>
      <Button danger onClick={handleReset}>清空</Button>
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        components: {
          Tabs: {
            horizontalMargin: '0px',
            height: '100%',
          },
        },
      }}
    >

      <div className={styles.container}>
        <div style={{ height: "10%" }}>
          <></>
        </div>
        <div className={styles.tabContent}>
          <Tabs defaultActiveKey="1" type="card" items={items} tabBarExtraContent={{ right: extraButtons }} />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Answer;