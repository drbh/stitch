import { execSync } from 'child_process';
import fs from 'fs';
import TOML from 'smol-toml';

export function getBuildHash() {
	try {
		const gitIncludingStaged = 'echo "$(git rev-parse HEAD)$(git diff --staged)" | md5sum | cut -c1-7';
		const date = new Date()
			.toISOString()
			.replace(/[^0-9]/g, '.')
			.slice(0, 10);
		const hash = execSync(gitIncludingStaged).toString().trim();
		const ver = `${date}.${hash}`;
		console.warn('[TRACE] Using dev hash:', `${ver}.dev`);
		return `${ver}.dev`;
	} catch (e) {
		const sourceHash = import.meta.env.SOURCE_HASH;
		console.warn('[TRACE] Falling back to SOURCE_HASH:', sourceHash);
		return sourceHash.replace(/\.dev$/, '');
	}
}

const versionHash = getBuildHash();

// set env variable for the build hash
process.env.BUILD_HASH = versionHash;

// update the wrangler.toml file with the build hash if needed
const wranglerTomlPath = 'wrangler.toml';
const wranglerToml = fs.readFileSync(wranglerTomlPath, 'utf8');
const parsedWranglerToml = TOML.parse(wranglerToml);

if (parsedWranglerToml['vars']['BUILD_HASH'] !== versionHash) {
	console.log('Updating wrangler.toml with new BUILD_HASH:', versionHash);
	parsedWranglerToml['vars']['BUILD_HASH'] = versionHash;
	const updatedWranglerToml = TOML.stringify(parsedWranglerToml);
	fs.writeFileSync(wranglerTomlPath, updatedWranglerToml);
}
