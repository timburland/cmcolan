#!/usr/bin/env python3
"""
Zillow/Redfin Image Downloader
Downloads all property images from a listing URL to your computer

Usage:
    python download_listing_images.py "https://www.zillow.com/homedetails/..."

Requirements:
    pip install requests beautifulsoup4
"""

import sys
import os
import re
import json
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from datetime import datetime


def download_listing_images(url, output_dir=None):
    """
    Download all images from a Zillow/Redfin listing
    
    Args:
        url: The listing URL
        output_dir: Optional custom output directory
    """
    
    print(f"🔍 Fetching listing from: {url}\n")
    
    # Setup output directory
    if output_dir is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"listing_images_{timestamp}"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"📁 Created directory: {output_dir}\n")
    
    # Fetch the page with browser-like headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching page: {e}")
        print("\n💡 Try opening the URL in your browser, then:")
        print("   1. Right-click → Save Page As → Complete")
        print("   2. Run this script on the saved HTML file")
        return []
    
    html = response.text
    soup = BeautifulSoup(html, 'html.parser')
    
    # Extract property details
    property_info = extract_property_info(html, soup)
    if property_info:
        print("🏠 Property Details:")
        print(f"   Address: {property_info.get('address', 'N/A')}")
        print(f"   Price: {property_info.get('price', 'N/A')}")
        print(f"   Beds: {property_info.get('beds', 'N/A')} | Baths: {property_info.get('baths', 'N/A')}")
        print()
    
    # Find all image URLs
    image_urls = extract_image_urls(html, soup, url)
    
    if not image_urls:
        print("❌ No images found. The listing may be blocking automated access.")
        print("\n💡 Alternative method:")
        print("   1. Open the listing in your browser")
        print("   2. Right-click on each image → 'Save Image As'")
        return []
    
    print(f"✅ Found {len(image_urls)} images\n")
    
    # Download each image
    downloaded = []
    for i, img_url in enumerate(image_urls, 1):
        try:
            print(f"⬇️  Downloading image {i}/{len(image_urls)}...", end=" ")
            
            # Get the image
            img_response = requests.get(img_url, headers=headers, timeout=10)
            img_response.raise_for_status()
            
            # Determine file extension
            content_type = img_response.headers.get('content-type', '')
            if 'jpeg' in content_type or 'jpg' in content_type:
                ext = 'jpg'
            elif 'png' in content_type:
                ext = 'png'
            elif 'webp' in content_type:
                ext = 'webp'
            else:
                ext = 'jpg'  # default
            
            # Save the image
            filename = f"image_{i:02d}.{ext}"
            filepath = os.path.join(output_dir, filename)
            
            with open(filepath, 'wb') as f:
                f.write(img_response.content)
            
            file_size = len(img_response.content) / 1024  # KB
            print(f"✅ Saved ({file_size:.1f} KB)")
            downloaded.append(filepath)
            
        except Exception as e:
            print(f"❌ Failed: {e}")
            continue
    
    # Save property info to JSON
    if property_info:
        info_file = os.path.join(output_dir, "property_info.json")
        with open(info_file, 'w') as f:
            json.dump(property_info, f, indent=2)
        print(f"\n💾 Saved property info to: property_info.json")
    
    print(f"\n🎉 Downloaded {len(downloaded)}/{len(image_urls)} images to: {output_dir}")
    return downloaded


def extract_property_info(html, soup):
    """Extract property details from the listing"""
    info = {}
    
    try:
        # Try JSON-LD structured data first
        json_ld = soup.find('script', type='application/ld+json')
        if json_ld:
            data = json.loads(json_ld.string)
            if isinstance(data, list):
                data = next((item for item in data if item.get('@type') in ['SingleFamilyResidence', 'House', 'Apartment']), {})
            
            if data:
                if 'address' in data:
                    addr = data['address']
                    info['address'] = f"{addr.get('streetAddress', '')}, {addr.get('addressLocality', '')}, {addr.get('addressRegion', '')} {addr.get('postalCode', '')}"
                
                info['description'] = data.get('description', '')
    
    except Exception as e:
        pass
    
    # Extract from meta tags as fallback
    if not info.get('address'):
        og_title = soup.find('meta', property='og:title')
        if og_title:
            info['address'] = og_title.get('content', '')
    
    # Extract price
    price_match = re.search(r'\$[\d,]+', html)
    if price_match:
        info['price'] = price_match.group(0)
    
    # Extract beds/baths
    beds_match = re.search(r'(\d+)\s*(?:bed|bd|bedroom)', html, re.IGNORECASE)
    if beds_match:
        info['beds'] = beds_match.group(1)
    
    baths_match = re.search(r'([\d.]+)\s*(?:bath|ba|bathroom)', html, re.IGNORECASE)
    if baths_match:
        info['baths'] = baths_match.group(1)
    
    return info


def extract_image_urls(html, soup, page_url):
    """Extract all property image URLs from the page"""
    image_urls = []
    
    # Method 1: JSON-LD structured data
    try:
        json_ld = soup.find('script', type='application/ld+json')
        if json_ld:
            data = json.loads(json_ld.string)
            if isinstance(data, list):
                data = next((item for item in data if item.get('@type') in ['SingleFamilyResidence', 'House', 'Apartment']), {})
            
            if 'image' in data:
                if isinstance(data['image'], list):
                    image_urls.extend(data['image'])
                else:
                    image_urls.append(data['image'])
    except Exception:
        pass
    
    # Method 2: Find all high-resolution image URLs in the HTML
    if not image_urls:
        # Pattern for Zillow images
        zillow_pattern = r'https://photos\.zillowstatic\.com/[^"\']+(?:uncropped_scaled_within_\d+|_d\.jpg)'
        image_urls.extend(re.findall(zillow_pattern, html))
        
        # Pattern for Redfin images
        redfin_pattern = r'https://ssl\.cdn-redfin\.com/photo/\d+/[^"\']+\.jpg'
        image_urls.extend(re.findall(redfin_pattern, html))
        
        # Pattern for Trulia images
        trulia_pattern = r'https://[^"\']*ap\.rdcpix\.com[^"\']+\.jpg'
        image_urls.extend(re.findall(trulia_pattern, html))
    
    # Method 3: og:image meta tag (usually the main photo)
    if not image_urls:
        og_image = soup.find('meta', property='og:image')
        if og_image:
            image_urls.append(og_image.get('content'))
    
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in image_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    # Filter to reasonable image sizes (try to get large versions)
    filtered_urls = []
    for url in unique_urls:
        # Skip thumbnails and small images
        if any(skip in url.lower() for skip in ['thumb', 'small', '150x', '200x', '300x']):
            continue
        filtered_urls.append(url)
    
    return filtered_urls[:20]  # Limit to 20 images


def main():
    if len(sys.argv) < 2:
        print("Usage: python download_listing_images.py <listing_url> [output_directory]")
        print("\nExample:")
        print('  python download_listing_images.py "https://www.zillow.com/homedetails/..."')
        print('  python download_listing_images.py "https://www.zillow.com/homedetails/..." my_images')
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Validate URL
    if not url.startswith('http'):
        print("❌ Please provide a valid URL starting with http:// or https://")
        sys.exit(1)
    
    downloaded = download_listing_images(url, output_dir)
    
    if not downloaded:
        print("\n💡 If automatic download fails, try:")
        print("   1. Open the listing in your browser")
        print("   2. Open Developer Tools (F12)")
        print("   3. Go to Network tab, filter by 'Img'")
        print("   4. Refresh page and right-click large images → 'Open in new tab'")
        print("   5. Save each image manually")


if __name__ == "__main__":
    main()
