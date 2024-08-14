/*
 * The MIT License
 *
 * Copyright 2022 Karate Labs Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
package com.intuit.karate.cli;

import com.intuit.karate.Main;
import com.intuit.karate.Runner;
import com.intuit.karate.StringUtils;
import picocli.CommandLine;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 *
 * @author pthomas3
 */
public class IdeMain {

    // adds double-quotes to last positional parameter (path) in case it contains white-spaces and un-quoted
    // only if line contains just one positional parameter (path) and it is the last one in line.
    // needed for intelli-j and vs-code generated cli invocations
    public static Main parseIdeCommandLine(String line) {
        Matcher matcher = CLI_ARGS.matcher(line);
        if (matcher.find()) {
            String path = matcher.group(2).trim();
            if (path.contains(" ")) {
                // unquote if necessary
                String options = line.substring(0, line.lastIndexOf(path));
                path = path.replaceAll("^\"|^'|\"$|\'$", "");
                line = String.format("%s \"%s\"", options, path);
            }
        }
        return Main.parseKarateOptions(line.trim());
    }

    // matches ( -X XXX )* (XXX)
    private static final Pattern CLI_ARGS = Pattern.compile("(\\s*-{1,2}\\w\\s\\S*\\s*)*(.*)$");
}
