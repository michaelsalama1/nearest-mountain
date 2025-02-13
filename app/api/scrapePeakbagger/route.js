import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
    console.log("hello");
    try {
        // Generate a random peak ID
        const peakId = Math.floor(Math.random() * 192424) + 1;
        console.log("try 1");
        const url = `https://www.peakbagger.com/peak.aspx?pid=${peakId}`;
       
        console.log("Fetching URL:", url);
        console.log('try 2');

        try {
            const response = await axios.get(url);
            console.log('Response status:', response.status);  // Check response status
        } catch (error) {
            console.error('Error status:', error.response?.status);
        }
        
        // Fetch the page content
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.peakbagger.com'
            }
        });
        
        console.log('try 3');
        
        // Extract peak name
        const nameMatch = data.match(/<h1>(.*?)<\/h1>/);
        console.log('try 4');
        const name = nameMatch ? nameMatch[1] : "Unknown";
        

        console.log("hellooo!!!");
        
        // Extract elevation, prominence, and isolation
        const elevationMatch = data.match(/Elevation:\s*(\d+\s*meters,\s*\d+\s*feet)/);
        const prominenceMatch = data.match(/Prominence:\s*(\d+\s*m,\s*\d+\s*ft)/);
        const isolationMatch = data.match(/True Isolation:\s*(\d+\.\d+\s*km,\s*\d+\.\d+\s*mi)/);
        
        const elevation = elevationMatch ? elevationMatch[1] : "Unknown";
        const prominence = prominenceMatch ? prominenceMatch[1] : "Unknown";
        const isolation = isolationMatch ? isolationMatch[1] : "Unknown";
        
        // Extract latitude and longitude
        const latLonMatch = data.match(/Latitude\/Longitude \(WGS84\)<\/td><td>([\d\.-]+),\s*([\d\.-]+)/);
        const latitude = latLonMatch ? latLonMatch[1] : "Unknown";
        const longitude = latLonMatch ? latLonMatch[2] : "Unknown";
        
        // Extract location details
        const countryMatch = data.match(/<td valign=top>Country<\/td><td>(.*?)<\/td>/);
        const stateMatch = data.match(/<td valign=top>State\/Province<\/td><td>(.*?)<\/td>/);
        const countyMatch = data.match(/<td valign=top>County\/Second Level Region<\/td><td>(.*?)<\/td>/);
        
        const country = countryMatch ? countryMatch[1] : "Unknown";
        const state = stateMatch ? stateMatch[1] : "Unknown";
        const county = countyMatch ? countyMatch[1] : "Unknown";
        
        return NextResponse.json({
            peakId,
            name,
            elevation,
            prominence,
            isolation,
            latitude,
            longitude,
            country,
            state,
            county,
            url
        });
    } catch (error) {
        console.log("WHAT");
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}
