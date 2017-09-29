/**
 * @fileOverview Basic webcrawler function -- uses sets to build a queue of
 * links to be returned
 *
 * @name crawler.js
 * @author Tyler Collins
 * @license MIT
 */
import { isURL } from 'validator';
import axios from 'axios';
import cheerio from 'cheerio';

/**
 * queueLinks - parses page content and appends all links on the page to existing queue.
 *
 * @param {AxiosResponse} pageContent axios response containing page data to be
 * parsed
 * @param {Function} filterFn function to be used to filter out urls (e.g.
 * removeMedia, noFTP, etc.)
 */
export function queueLinks(pageContent, filterFn) {
  if (pageContent.status === 200) {
    const links = cheerio.load(pageContent.data)('a');
    return new Set(Object.keys(links)
      .map((n) => {
        if (links[n].attribs) {
          return links[n].attribs.href;
        }
        return null;
      })
      .filter(url => typeof url === 'string')
      .filter(filterFn)
      .map(url => url.replace(/^https/, 'http')));
  }
  console.log(Error(`Website returned an error: ${pageContent.status}`));
  return new Set();
}

/**
 * crawl - Crawls through page links and builds a set of all pages to test.
 * Goes 5 levels deep through links checking for new pages by default
 *
 * @param {String} domain domain to crawl through
 * @param {Number} depth Levels to recurse through website to find new links.
 * @param {Function} filterFn function to be used to filter out urls (e.g.
 * removeMedia, noFTP, etc.)
 * @returns {Set<String>} queue of all unique links matching filterFn
 */
export default async function crawl(domain, depth = 5, filterFn) {
  // Validate url and throw error if invalid
  const url = `http://${domain}`;
  if (!isURL(url)) {
    throw new Error(`Invalid url: ${url}`);
  }

  // Return initial url if depth === 0
  if (depth === 0) {
    return new Set([url]);
  }

  // Scrape main url
  const mainPage = await axios.get(url);

  const allLinks = await queueLinks(mainPage, filterFn);
  let links = new Set([...allLinks]);

  for (let i = 1; i < depth; ++i) {
    if (links.size == 0) {
      i = depth;
    }
    const newLinks = await Promise.all([...links].map(async (url) => {
      const newPage = await axios.get(url);
      return queueLinks(newPage, filterFn);
    }));

    const newLinkSet = newLinks
      .reduce((urlList, urlSet) => {
        if (urlList instanceof Set) {
          for (const url of urlList) {
            urlSet.add(url);
          }
          return urlSet;
        }
        return urlSet;
      }, new Set([]));
    links = newLinkSet.difference(allLinks);
    for (const url of newLinkSet) {
      allLinks.add(url);
    }
  }
  return allLinks;
}

