import {expect} from 'chai';
import {DBFFile} from 'dbffile';
import * as path from 'path';

async function get_records<T>(path: string) {
  const dbf = await DBFFile.open(path, {
    readMode: 'loose',
    encoding: 'gb2312',
  });
  return (await dbf.readRecords(dbf.recordCount)) as T[];
}

describe("Decoding a DBF file with cross-block charactor", () => {
  it("TheGPCRdatabase", async () => {
    const mainfile = await get_records<{
      DOCID: number;
      TITLE: string;
      CONTENTS: string;
      YEAR: number;
      MONTH: number;
      DAY: number;
      PARENTID: number;
    }>(path.join(__dirname, "./fixtures/mainfile.dbf"));
    const str = JSON.stringify(mainfile[11]);
    expect(str).equals(
      JSON.stringify({
        DOCID: 12,
        PARENTID: 5,
        YEAR: 1966,
        MONTH: 2,
        DAY: 12,
        TITLE: "中共中央关于印发毛泽东同志在扩大的中央工作会议上的讲话的通知",
        CONTENTS:
          "中共中央关于印发毛泽东同志在扩大的中央工作会议上的讲话的通知\r\n1966.02.12\r\n\r\n各中央局，各省、市、自治区党委，中央各部委，国家机关和人民团体各党委、党组，总政治部：\r\n    毛泽东同志一九六二年一月三十日“在扩大的中央工作会议上的讲话”，是一个十分重要的马克思列宁主义的文件。中央决定，将这个文件发耠你们，供党内县团体以上干部学习。毛泽东同志在这个讲话中，着重讲了民主集中制的问题。这个问题是我们党的生活中一个根本性的问题。在我们党掌握了全国政权以后，这个问题尤其重要。毛泽东同志最近指出：“看来此问题很大，真要实现民主集中制，是要经过认真的教育、试点和推广，并且经过长期反复进行，才能实现的，否则在大多数同志当中，始终不过是一句空话。”望各地区、各部门根据毛泽东同志的指示，认真地学习这个文件，发扬批评和自我批评的精神，教育广大干部，特别是领导干部，认其贯彻实行民主集中制和纠正违反民主集中制的各种不良倾向。\r\n\r\n    （发至县团级党委，不登党刊）",
      })
    );
  });
});