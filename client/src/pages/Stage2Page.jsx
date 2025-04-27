import { Layout, Card, Button, Tabs, Collapse, Input } from 'antd';
import StageSwitcher from '../components/StageSwitcher';
import TopicStage2 from '../components/TopicStage2';
import Answer from '../components/Answer';
import Check from '../components/Check';
import { Row, Col } from 'antd';

export default function Stage2Page() { 
    return (
      <div>
        <Row>
          <Col span={6}>
            <TopicStage2 />
          </Col>
          <Col span={12}>
            <Answer />
          </Col>
          <Col span={6}>
            <Check />
          </Col>
        </Row>
      </div>
    );
}
