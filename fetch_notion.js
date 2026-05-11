const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID.replace(/-/g, '');

async function fetchBooks() {
  try {
    console.log(`正在抓取資料庫內容...`);
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Reading Status',
        select: { equals: 'Finished' } // 這裡修正了：從 status 改成 select
      }
    });

    const books = response.results.map(page => {
      const p = page.properties;
      
      // 處理日期與年份
      const dateVal = p['Date Finished']?.date?.start;
      const year = dateVal ? new Date(dateVal).getFullYear() : 2026;

      // 取得作者與評分
      const author = p['Author']?.rich_text[0]?.plain_text || '未知作者';
      const rating = p['Rating']?.select?.name || '★★★★★';

      // 隨機書脊顏色 (你也可以根據 Genres 設定)
      const colors = ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#d35400'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      return {
        title: p['Name']?.title[0]?.plain_text || '無標題',
        author: author,
        rating: rating,
        year: year,
        color: randomColor,
        note: "尚無心得", // 如果你之後在 Notion 增加 Note 欄位，可以改這裡
        height: 180 + Math.floor(Math.random() * 50),
        width: 35 + Math.floor(Math.random() * 15)
      };
    });

    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log(`✅ 抓取成功！共抓到 ${books.length} 本書。`);
  } catch (error) {
    console.error('❌ 抓取失敗詳細訊息:', error.message);
    process.exit(1);
  }
}

fetchBooks();
