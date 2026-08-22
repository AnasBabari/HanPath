import fs from 'node:fs';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');
const root = process.cwd();
const curriculum = JSON.parse(
  fs.readFileSync(path.join(root, 'src', 'data', 'curriculum_hsk3_v1.json'), 'utf8')
);

for (const level of [1, 2]) {
  const allowedWords = level === 1
    ? curriculum.hsk1
    : [...curriculum.hsk1, ...curriculum.hsk2];
  const levelByHanzi = new Map(allowedWords.map(word => [word.hanzi, word.hskLevel]));
  const sourcePath = path.join(root, 'src', 'data', `stories_hsk${level}.json`);
  const publicPath = path.join(root, 'public', 'data', `stories_hsk${level}.json`);
  const stories = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  for (const story of stories) {
    for (const token of story.tokens) {
      if (!token.is_word) {
        token.hsk_level = 0;
        delete token.is_support;
        continue;
      }

      const curriculumLevel = levelByHanzi.get(token.token);
      if (curriculumLevel) {
        token.hsk_level = curriculumLevel;
        delete token.is_support;
      } else {
        // Graded readers may use a bounded set of individually glossed support
        // words. They must be explicit rather than mislabelled as curriculum.
        token.hsk_level = 0;
        token.is_support = true;
      }
    }
  }

  const normalized = `${JSON.stringify(stories, null, 2)}\n`;
  if (checkOnly) {
    const sourceCurrent = fs.readFileSync(sourcePath, 'utf8');
    const publicCurrent = fs.readFileSync(publicPath, 'utf8');
    if (sourceCurrent !== normalized || publicCurrent !== normalized) {
      throw new Error(`Story support metadata is stale for HSK ${level}. Run npm run build:stories.`);
    }
  } else {
    fs.writeFileSync(sourcePath, normalized, 'utf8');
    fs.writeFileSync(publicPath, normalized, 'utf8');
  }
}

console.log(checkOnly ? 'Story support metadata is current.' : 'Story support metadata normalized.');
