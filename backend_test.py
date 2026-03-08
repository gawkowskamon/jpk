import requests
import sys
import os
from datetime import datetime
from pathlib import Path

class JPKConverterAPITester:
    def __init__(self, base_url="https://vat-to-fa.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.conversion_id = None
        self.sample_xml_path = "/app/tests/sample_jpk_vat.xml"

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {}
        
        # Don't set Content-Type for file uploads
        if not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response if possible
                try:
                    json_response = response.json()
                    if isinstance(json_response, dict) and len(str(json_response)) < 500:
                        print(f"   Response: {json_response}")
                    elif isinstance(json_response, list):
                        print(f"   Response: List with {len(json_response)} items")
                except:
                    print(f"   Response: Non-JSON or large response")
                    
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text[:200]}")

            return success, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_preview_file(self):
        """Test /api/preview endpoint with sample XML"""
        if not os.path.exists(self.sample_xml_path):
            print(f"❌ Sample XML file not found at {self.sample_xml_path}")
            return False
            
        with open(self.sample_xml_path, 'rb') as f:
            files = {'file': ('sample_jpk_vat.xml', f, 'application/xml')}
            success, response = self.run_test(
                "Preview JPK_VAT File",
                "POST",
                "preview",
                200,
                files=files
            )
            
            if success and response:
                try:
                    data = response.json()
                    print(f"   Preview data: {data.get('records_count', 0)} records found")
                    print(f"   Source type: {data.get('source_type', 'N/A')}")
                    print(f"   Source version: {data.get('source_version', 'N/A')}")
                except:
                    pass
                    
        return success

    def test_convert_file(self):
        """Test /api/convert endpoint"""
        if not os.path.exists(self.sample_xml_path):
            print(f"❌ Sample XML file not found at {self.sample_xml_path}")
            return False
            
        with open(self.sample_xml_path, 'rb') as f:
            files = {'file': ('sample_jpk_vat.xml', f, 'application/xml')}
            success, response = self.run_test(
                "Convert JPK_VAT to JPK_FA",
                "POST",
                "convert?target_version=FA(4)",
                200,
                files=files
            )
            
            if success and response:
                # Check if we got a conversion ID in headers
                conversion_id = response.headers.get('X-Conversion-Id')
                if conversion_id:
                    self.conversion_id = conversion_id
                    print(f"   Conversion ID: {conversion_id}")
                
                # Check if response is XML content
                content_type = response.headers.get('Content-Type', '')
                if 'xml' in content_type:
                    print(f"   Received XML file, size: {len(response.content)} bytes")
                else:
                    print(f"   Content-Type: {content_type}")
                    
        return success

    def test_get_history(self):
        """Test /api/history endpoint"""
        success, response = self.run_test(
            "Get Conversion History",
            "GET",
            "history",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                print(f"   History items: {len(data)}")
                if data and len(data) > 0:
                    latest = data[0]
                    print(f"   Latest conversion: {latest.get('original_filename', 'N/A')}")
                    # Store conversion ID for export test
                    if not self.conversion_id and latest.get('id'):
                        self.conversion_id = latest['id']
            except:
                pass
                
        return success

    def test_export_xlsx(self):
        """Test /api/export/{id} endpoint for XLSX format"""
        if not self.conversion_id:
            print("❌ No conversion ID available for export test")
            return False
            
        success, response = self.run_test(
            "Export to XLSX",
            "GET",
            f"export/{self.conversion_id}?format=xlsx",
            200
        )
        
        if success and response:
            content_type = response.headers.get('Content-Type', '')
            if 'spreadsheet' in content_type or 'excel' in content_type:
                print(f"   Received XLSX file, size: {len(response.content)} bytes")
            else:
                print(f"   Content-Type: {content_type}")
                
        return success

    def test_export_csv(self):
        """Test /api/export/{id} endpoint for CSV format"""
        if not self.conversion_id:
            print("❌ No conversion ID available for export test")
            return False
            
        success, response = self.run_test(
            "Export to CSV",
            "GET",
            f"export/{self.conversion_id}?format=csv",
            200
        )
        
        if success and response:
            content_type = response.headers.get('Content-Type', '')
            if 'csv' in content_type:
                print(f"   Received CSV file, size: {len(response.content)} bytes")
            else:
                print(f"   Content-Type: {content_type}")
                
        return success

    def test_invalid_file_upload(self):
        """Test uploading invalid file format"""
        # Create a temporary non-XML file
        temp_content = b"This is not an XML file"
        files = {'file': ('test.txt', temp_content, 'text/plain')}
        
        success, response = self.run_test(
            "Upload Invalid File Format",
            "POST",
            "preview",
            400,  # Expecting 400 Bad Request
            files=files
        )
        return success

def main():
    print("🚀 Starting JPK Converter API Tests")
    print("=" * 50)
    
    # Setup
    tester = JPKConverterAPITester()
    
    # Run all tests
    tests = [
        tester.test_root_endpoint,
        tester.test_preview_file,
        tester.test_convert_file,
        tester.test_get_history,
        tester.test_export_xlsx,
        tester.test_export_csv,
        tester.test_invalid_file_upload,
    ]
    
    for test in tests:
        test()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests Summary:")
    print(f"   Total tests: {tester.tests_run}")
    print(f"   Passed: {tester.tests_passed}")
    print(f"   Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.conversion_id:
        print(f"   Conversion ID for further testing: {tester.conversion_id}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())