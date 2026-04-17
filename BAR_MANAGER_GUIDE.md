# Urban Kitchen Wine List Update Guide

This is the simple version for updating the live wine list.

## The one file you edit

Edit this file only:

```text
data/wines.csv
```

Do not rename it.

Do not upload an Excel file.

The file must stay a CSV file.

## Step 1: Open the wine list file

Open `wines.csv` in Excel or Google Sheets.

Make the wine list changes there.

## Step 2: Save or download as CSV

When finished, save or download the file as:

```text
wines.csv
```

Important:

- The name must be exactly `wines.csv`
- It must end in `.csv`
- Do not save it as `.xlsx`
- Do not make a copy named `wines (1).csv`

## Step 3: Upload it to GitHub

Go to the GitHub project.

Open the `data` folder.

Click `wines.csv`.

Upload the new `wines.csv` file to replace the old one.

## Step 4: Commit the change

GitHub will ask you to commit the file.

Use a simple message like:

```text
Update wine list
```

Click the green commit button.

## Step 5: Tell the website manager

After uploading, tell the website manager:

```text
The wine CSV has been updated.
```

They will run the final update step that prepares the website data.

## Quick checks before uploading

Before you upload, check these:

- The file is named `wines.csv`
- The file is a CSV
- The first row with the column names is still there
- You did not delete any columns
- Prices are plain numbers, like `72`, not `$72`
- Staff picks use `Y` or `N`
- Show uses `Y` or `N`

## If something goes wrong

Stop and ask for help.

Do not keep uploading different versions.

It is much easier to fix one clean mistake than several guesses.
