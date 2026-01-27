# Admin Portal - Simple Guide for Secretaries

## What This Is

This is a simple website where you can add, edit, and manage home listings for the C. M. Conlan website. It works just like the WordPress system you're used to, but even simpler!

## How to Access

1. Go to: `https://your-website.azurestaticapps.net/admin`
2. Enter the password: `conlan2026`
3. Click "Login"

## Adding a New Home

### Step 1: Click "Add New Home"

Click the big gold button that says "+ Add New Home"

### Step 2: Upload Photos

**Main Photo:**
1. Click the box that says "Upload Main Property Photo"
2. Select the main exterior photo from your computer
3. You'll see a preview appear

**Additional Photos (Optional):**
1. Click the box that says "Upload Additional Photos"
2. You can select multiple photos at once (interior shots, different angles, etc.)
3. You'll see previews of all photos

**Tip:** You can also drag and drop photos directly into these boxes!

### Step 3: Fill Out the Form

Fill in all the property details:

- **Property Headline**: Give it a catchy title (e.g., "Beautiful Modern Home in Bethesda")
- **Street Address**: The street address
- **City**: City name
- **State**: Just type "MD"
- **ZIP Code**: If you have it
- **Description**: Write 2-4 sentences about the property
- **Bedrooms**: Number of bedrooms
- **Bathrooms**: Number of bathrooms (you can use .5 for half baths)
- **Parking Spaces**: How many parking spots
- **Garage Spaces**: How many garage spots
- **Status**: Choose "For Sale", "POA", or "Sold"
- **Price**: If it has a price, enter it (like "$2,500,000")
- **Features**: List special features, one per line:
  ```
  New Construction
  Hardwood Floors
  Gourmet Kitchen
  Master Suite
  ```

### Step 4: Save

1. Click the gold "Save Home" button at the bottom
2. You'll see a green success message
3. A file called `homes.json` will automatically download to your computer
4. **IMPORTANT:** Email this `homes.json` file to your web administrator (or whoever manages the website)

That's it! You're done!

## Editing an Existing Home

1. Find the home in the list
2. Click the "Edit" button
3. Make your changes
4. Click "Save Home"
5. Email the new `homes.json` file to your web administrator

## Deleting a Home

1. Find the home in the list
2. Click the "Delete" button
3. Confirm you want to delete it
4. Email the new `homes.json` file to your web administrator

## Important Notes

### About the homes.json File

Every time you save a change, the system automatically downloads a file called `homes.json`. This file contains all the home listings. 

**You need to send this file to your web administrator so they can update the website.**

Think of it like saving a Word document - you make your changes, save, and then send it to someone to publish.

### The images are saved inside the file

When you upload photos, they're saved inside the `homes.json` file automatically. You don't need to send the photos separately - just the `homes.json` file contains everything!

### Your work is automatically saved in your browser

As long as you use the same computer and browser, your listings will still be there when you come back. But it's good practice to save your work (click "Save Home") frequently.

### Password

The default password is `conlan2026`. If you need to change it, ask your web administrator.

## Troubleshooting

**Q: I uploaded a photo but it's not showing up**
A: Make sure you clicked inside the upload box and selected a photo. You should see a preview appear.

**Q: I can't see my homes when I log in**
A: Make sure you're using the same computer and browser. Try refreshing the page.

**Q: The download didn't work**
A: Check your Downloads folder - the file is called `homes.json`

**Q: I made a mistake!**
A: No problem! Just click "Edit" on that home and fix it. Or click "Delete" to remove it completely.

## Need Help?

If you have any questions or problems, contact your web administrator or the person who set this up for you.

---

**Remember:** 
1. Upload photos from your computer
2. Fill out the form
3. Click Save
4. Email the `homes.json` file to your web administrator

It's that simple!
