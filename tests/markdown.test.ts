import { describe, expect, it } from 'vitest';
import { replaceDailyFields } from '../src/core/markdown';

const values = { bilibili: 1837, douyin: 642, kuaishou: 0, youtube: 3128 };

describe('replaceDailyFields', () => {
  it('changes only exact unique PC fields and preserves all surrounding text', () => {
    const source = '# Daily\r\ntext\r\n[PCBilibiliSeconds:: 0]\r\n[PCDouyinSeconds:: 0]\r\n[PCKuaishouSeconds:: 0]\r\n[PCYouTubeSeconds:: 0]\r\nfooter\r\n';
    const result = replaceDailyFields(source, values);
    expect(result.text).toBe('# Daily\r\ntext\r\n[PCBilibiliSeconds:: 1837]\r\n[PCDouyinSeconds:: 642]\r\n[PCKuaishouSeconds:: 0]\r\n[PCYouTubeSeconds:: 3128]\r\nfooter\r\n');
    expect(result.updatedFields).toEqual(['bilibili', 'douyin', 'kuaishou', 'youtube']);
    expect(result.blockedFields).toEqual([]);
    expect(result.missingFields).toEqual([]);
    expect(result.malformedFields).toEqual([]);
    expect(result.duplicatedFields).toEqual([]);
  });

  it('refuses malformed and duplicated fields without changing them', () => {
    const source = '[PCBilibiliSeconds:: 1]\n[PCBilibiliSeconds:: 2]\n[PCDouyinSeconds:: 3 ]\n';
    const result = replaceDailyFields(source, values);
    expect(result.text).toBe(source);
    expect(result.blockedFields).toEqual(expect.arrayContaining(['bilibili', 'douyin']));
    expect(result.duplicatedFields).toEqual(['bilibili']);
    expect(result.malformedFields).toEqual(['douyin']);
    expect(result.missingFields).toEqual(['kuaishou', 'youtube']);
  });

  it('classifies fields that are entirely absent as missing', () => {
    const source = '# Daily\n今日没有字段。\n';
    const result = replaceDailyFields(source, values);
    expect(result.text).toBe(source);
    expect(result.updatedFields).toEqual([]);
    expect(result.blockedFields).toEqual(['bilibili', 'douyin', 'kuaishou', 'youtube']);
    expect(result.missingFields).toEqual(['bilibili', 'douyin', 'kuaishou', 'youtube']);
    expect(result.malformedFields).toEqual([]);
    expect(result.duplicatedFields).toEqual([]);
  });
});
