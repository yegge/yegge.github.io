# macOS Terminal Commands
##### most commonly used
## ---

**📂 File & Directory Management**

These are your bread-and-butter commands for moving around the system.

* ls: Lists all files and folders in the current directory. (Try ls \-la for hidden files).  
* cd \[path\]: Change directory (e.g., cd \~/Desktop).  
* pwd: "Print Working Directory"—shows exactly where you are.  
* mkdir \[folder\]: Create a new folder.  
* touch \[file\]: Create a new empty file.  
* cp \[source\] \[destination\]: Copy files or folders.  
* mv \[source\] \[destination\]: Move or rename files.  
* rm \[file\]: Delete a file. **Warning:** This is permanent; there is no "Trash" bin here.  
* rm \-rf \[folder\]: Forcefully delete a folder and everything inside it.

## ---

**📝 File Content & Editing**

For looking inside files without opening a heavy app like TextEdit.

* cat \[file\]: Displays the entire contents of a file in the terminal.  
* less \[file\]: View a file one page at a time (press q to exit).  
* head \-n \[x\] \[file\]: View the first x lines of a file.  
* grep "\[text\]" \[file\]: Search for a specific string of text inside a file.  
* nano \[file\]: A simple, user-friendly text editor built into the terminal.  
* vim \[file\]: A powerful (but steep learning curve) text editor.

## ---

**⚙️ System & Process Management**

To see what your Mac is doing under the hood.

* top: Displays real-time CPU and memory usage (press q to exit).  
* htop: A more colorful, readable version of top (may require installation via Homebrew).  
* ps aux: Lists every running process.  
* kill \[PID\]: Stops a process using its ID number.  
* killall \[App Name\]: Force quits all instances of an app (e.g., killall Finder).  
* caffeinate: Prevents your Mac from sleeping as long as the terminal is open.  
* sudo: "SuperUser Do"—runs a command with administrative privileges (requires password).

## ---

**🌐 Networking**

* ping \[url\]: Checks your connection to a server.  
* ifconfig: Shows your network interface details (IP addresses, MAC addresses).  
* curl \-O \[url\]: Downloads a file from the internet via terminal.  
* ssh \[user\]@\[host\]: Log into a remote server securely.

## ---

**🛠️ Mac-Specific "Power User" Commands**

These are unique to macOS and control system-level features.

* open .: Opens the current terminal folder in a Finder window.  
* screencapture \-t jpg \[filename.jpg\]: Takes a screenshot via terminal.  
* tmutil listbackups: Lists all your Time Machine backups.  
* diskutil list: Shows all connected drives and partitions.  
* softwareupdate \-l: Checks for available macOS system updates.  
* pbcopy \< \[file\]: Copies the contents of a file to your clipboard.  
* pbpaste: Pastes your clipboard content into the terminal.

### ---

**💡 Pro Tip: The Manual**

If you ever want to know exactly what a command does and every "flag" (option) it has, type man followed by the command:  
man ls  
This opens the **manual page**. Use the arrow keys to scroll and q to exit.  
Would you like to know how to install a package manager like **Homebrew** to add even more commands to this list?