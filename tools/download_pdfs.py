"""
Download all CAP High School Prize Exam PDFs
"""
import os
import requests
from pathlib import Path

# PDF URLs organized by year
PDFS = {
    2025: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2025/06/2025_CAP_Exam_with-Solutions-May-7-2025.pdf",
        "solutions": None  # Combined with exam
    },
    2024: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2025/05/2024_CAP_Exam_with-solutions_May62025.pdf",
        "solutions": None  # Combined with exam
    },
    2023: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2023/09/2023_CAP_exam-English.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2024/04/2023_CAP_solution.pdf"
    },
    2022: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2023/03/2022CAPexam_English.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2023/03/ENGsolutions_2022_Mar282023.pdf"
    },
    2019: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2022/09/CAP-exam-2019-final-corrected.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2023/03/cap-2019-solutions-protected.pdf"
    },
    2018: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2019/03/cap-2018-v6_protected.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2020/08/2018-cap-protected-20200813.pdf"
    },
    2017: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/CAP-High-School-Prize-Exam-2017-English-v3.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/CAP-High-School-Prize-Exam-2017-English-solutions.pdf-1.pdf"
    },
    2016: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2017/02/cap-2016-final-3-En.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2018/10/2016-solutions-corrected-2018.pdf"
    },
    2015: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/CAP-en-v7.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/CAP-exam-solutions-En.pdf"
    },
    2014: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2014e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/cap2014sol.pdf"
    },
    2013: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2013e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2013e.pdf"
    },
    2012: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2012e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2012e.pdf"
    },
    2011: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2011e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2011e.pdf"
    },
    2010: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2010e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2010e.pdf"
    },
    2009: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2009e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2009e.pdf"
    },
    2008: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2008e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2008e.pdf"
    },
    2007: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2007e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2007e.pdf"
    },
    2006: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2006e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2006e.pdf"
    },
    2005: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2005e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2005e.pdf"
    },
    2004: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2004e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2004e.pdf"
    },
    2003: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2003e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2003e.pdf"
    },
    2002: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2002e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2002e.pdf"
    },
    2001: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2001e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2001e.pdf"
    },
    2000: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/2000e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol2000e.pdf"
    },
    1999: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1999e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1999e.pdf"
    },
    1998: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1998e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1998e.pdf"
    },
    1997: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1997e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1997e.pdf"
    },
    1996: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1996e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1996e.pdf"
    },
    1995: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1995e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1995e.pdf"
    },
    1994: {
        "exam": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/1994e.pdf",
        "solutions": "https://phas-outreach.sites.olt.ubc.ca/files/2015/08/sol1994e.pdf"
    },
}

def download_file(url, filepath):
    """Download a file from URL to filepath"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False

def decrypt_pdf(input_path, output_path, password="dowager"):
    """Decrypt a password-protected PDF"""
    try:
        import pikepdf
        with pikepdf.open(input_path, password=password, allow_overwriting_input=True) as pdf:
            # Check if actually encrypted
            if pdf.is_encrypted:
                pdf.save(output_path)
                return True
            else:
                # Not encrypted, no action needed if same file
                if str(input_path) != str(output_path):
                    import shutil
                    shutil.copy(input_path, output_path)
                return True
    except Exception as e:
        print(f"  Error decrypting {input_path}: {e}")
        return False

def main():
    # Output directory
    output_dir = Path(__file__).parent.parent / "CAP_Exams"
    output_dir.mkdir(exist_ok=True)

    print(f"Downloading PDFs to {output_dir}\n")

    for year, urls in sorted(PDFS.items()):
        print(f"\n{year}:")

        # Download exam
        exam_path = output_dir / f"{year}_exam.pdf"
        if urls["exam"]:
            if exam_path.exists():
                print(f"  Exam: Already exists")
            else:
                print(f"  Exam: Downloading...", end=" ")
                temp_path = output_dir / f"{year}_exam_temp.pdf"
                if download_file(urls["exam"], temp_path):
                    # Try to decrypt (in case it's protected)
                    if decrypt_pdf(temp_path, exam_path):
                        if temp_path.exists() and temp_path != exam_path:
                            temp_path.unlink()
                        print("Done")
                    else:
                        temp_path.rename(exam_path)
                        print("Done (no decrypt needed)")

        # Download solutions
        if urls["solutions"]:
            sol_path = output_dir / f"{year}_solutions.pdf"
            if sol_path.exists():
                print(f"  Solutions: Already exists")
            else:
                print(f"  Solutions: Downloading...", end=" ")
                temp_path = output_dir / f"{year}_solutions_temp.pdf"
                if download_file(urls["solutions"], temp_path):
                    if decrypt_pdf(temp_path, sol_path):
                        if temp_path.exists():
                            temp_path.unlink()
                        print("Done")
                    else:
                        temp_path.rename(sol_path)
                        print("Done (kept original)")
        else:
            print(f"  Solutions: Combined with exam")

    # Summary
    print("\n" + "="*50)
    pdf_files = list(output_dir.glob("*.pdf"))
    print(f"Total PDFs downloaded: {len(pdf_files)}")
    total_size = sum(f.stat().st_size for f in pdf_files)
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")

if __name__ == "__main__":
    main()
