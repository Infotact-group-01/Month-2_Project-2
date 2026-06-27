const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');

const client = new Client({
  node: 'http://elasticsearch:9200'
});

async function uploadSemgrep() {

  const data = JSON.parse(
    fs.readFileSync(
      './security-reports/semgrep-results.json'
    )
  );

  for (const finding of data.results) {

    await client.index({
      index: 'semgrep-findings',
      document: finding
    });

  }
}

uploadSemgrep();
