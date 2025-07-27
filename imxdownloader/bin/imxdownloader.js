#!/usr/bin/env node

const { program } = require('commander');
const downloadGallery = require('../lib/scraper');

program
  .name('imxdownloader')
  .description('Download and zip full-res images from IMX.to galleries')
  .argument('<url>', 'IMX.to gallery URL')
  .option('-a, --all', 'Download all images')
  .option('-n, --number <count>', 'Download N images only', parseInt)
  .option('-o, --output <folder>', 'Output folder name', 'downloads')
  .action(async (url, options) => {
    const limit = options.all ? null : options.number || 5;
    await downloadGallery({ url, limit, outputDir: options.output });
  });

program.parse();
